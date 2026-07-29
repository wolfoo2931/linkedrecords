import IdpAdapter from './types';

// Authentik's flow executor (`ak-flow-executor`) is a LitElement web
// component that renders each flow stage as its own custom element with its
// own (open) shadow root, e.g.:
//   ak-flow-executor
//     #shadow-root
//       ak-stage-identification   (email/username, then "Log in")
//         #shadow-root -> input[name=uidField], button[type=submit]
//       ak-stage-password         (replaces the identification stage)
//         #shadow-root -> input[name=password], button[type=submit]
// WebdriverIO's shadow$ command (classic WebDriver protocol, forced by this
// suite's capabilities) does not reliably pierce two nested shadow roots, so
// this adapter reaches into the DOM directly via execute() instead - the
// same approach used to explore this structure in the first place.
async function setInputValue(
  browser: WebdriverIO.Browser,
  stageTag: string,
  inputSelector: string,
  value: string,
): Promise<void> {
  await browser.waitUntil(
    () => browser.execute((tag, selector) => {
      const stage = document.querySelector('ak-flow-executor')?.shadowRoot
        ?.querySelector(tag) as HTMLElement & { shadowRoot: ShadowRoot | null };
      return !!stage?.shadowRoot?.querySelector(selector);
    }, stageTag, inputSelector),
    { timeout: 100000, timeoutMsg: `Authentik stage '${stageTag}' did not show '${inputSelector}' in time` },
  );

  await browser.execute((tag, selector, val) => {
    const stage = document.querySelector('ak-flow-executor')?.shadowRoot
      ?.querySelector(tag) as HTMLElement & { shadowRoot: ShadowRoot | null };
    const input = stage?.shadowRoot?.querySelector(selector) as HTMLInputElement;
    input.value = val;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, stageTag, inputSelector, value);
}

function clickSubmit(browser: WebdriverIO.Browser, stageTag: string): Promise<void> {
  return browser.execute((tag) => {
    const stage = document.querySelector('ak-flow-executor')?.shadowRoot
      ?.querySelector(tag) as HTMLElement & { shadowRoot: ShadowRoot | null };
    (stage?.shadowRoot?.querySelector('button[type=submit]') as HTMLElement)?.click();
  }, stageTag);
}

async function stageGone(browser: WebdriverIO.Browser, stageTag: string): Promise<boolean> {
  return !(await browser.execute((tag) => !!(
    document.querySelector('ak-flow-executor')?.shadowRoot?.querySelector(tag)
  ), stageTag));
}

// Clicking submit doesn't by itself confirm Authentik actually processed it: under heavy
// concurrent load (several browsers logging in at once - see helpers/session.ts) the click
// can race the stage's own event-listener attachment and get silently swallowed, leaving the
// browser stuck on that stage forever with nothing downstream to detect it (the next thing
// that would notice is the generic, much-later window.lr timeout).
//
// This used to poll every 500ms and re-click on every tick the stage was still present - but
// a real submit (e.g. password verification) can easily take longer than 500ms to process,
// so that re-clicked a request that was already in flight. Resubmitting the same password
// stage repeatedly looks exactly like a brute-force attempt to Authentik's own reputation/
// throttling policies, which can make a login stall for a long time and then eventually
// succeed - i.e. it can turn a rare missed-click race into a much more common, much longer
// stall than the bug it was meant to fix.
//
// So: click once, give it a real grace period to genuinely process, and only click a second
// time (never more) if the stage is still there after that.
async function submitStage(browser: WebdriverIO.Browser, stageTag: string): Promise<void> {
  await clickSubmit(browser, stageTag);

  try {
    await browser.waitUntil(() => stageGone(browser, stageTag), { timeout: 5000, interval: 250 });
    return;
  } catch {
    // Still on this stage after a reasonable processing window - the click likely didn't
    // register at all (rather than merely being slow to process). Click once more and wait
    // out the full budget without clicking again.
  }

  await clickSubmit(browser, stageTag);

  await browser.waitUntil(
    () => stageGone(browser, stageTag),
    {
      timeout: 100000,
      timeoutMsg: `Authentik stage '${stageTag}' never went away after clicking submit twice`,
    },
  );
}

export default class Authentik implements IdpAdapter {
  // eslint-disable-next-line class-methods-use-this
  async login(browser: WebdriverIO.Browser, email: string, password: string): Promise<void> {
    await setInputValue(browser, 'ak-stage-identification', 'input[name=uidField]', email);
    await submitStage(browser, 'ak-stage-identification');

    // The default flow only shows a password stage for users who have one
    // configured (all our test users do), and only after the identification
    // stage's DOM has been replaced - waitUntil above handles that.
    await setInputValue(browser, 'ak-stage-password', 'input[name=password]', password);
    await submitStage(browser, 'ak-stage-password');
  }
}
