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

async function submitStage(browser: WebdriverIO.Browser, stageTag: string): Promise<void> {
  await browser.execute((tag) => {
    const stage = document.querySelector('ak-flow-executor')?.shadowRoot
      ?.querySelector(tag) as HTMLElement & { shadowRoot: ShadowRoot | null };
    (stage?.shadowRoot?.querySelector('button[type=submit]') as HTMLElement)?.click();
  }, stageTag);
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
