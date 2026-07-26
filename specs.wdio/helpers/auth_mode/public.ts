import AuthModeStrategy from './types';

// Public client mode: the test app runs the SDK's oidc redirect flow
// (authorization code + PKCE) itself and talks to the server with bearer
// tokens. Requires the server to run with ALLOW_HTTP_AUTHENTICATION_HEADER
// and an AUTH_TOKEN_AUDIENCE matching the audience the test app requests
// (bin/test.wdio.sh and the test app webpack build wire this up from env).
export default class PublicClientMode implements AuthModeStrategy {
  // eslint-disable-next-line class-methods-use-this
  async initiateLogin(browser: WebdriverIO.Browser): Promise<void> {
    // 30s: see the matching wait in helpers/session.ts for why 10s isn't enough under
    // concurrent Authentik logins (REUSE_TEST_BROWSERS=true).
    await browser.waitUntil(
      async () => browser.execute(() => typeof (window as any).lr !== 'undefined'),
      {
        timeout: 30000,
        timeoutMsg: 'window.lr was not initialized within 30 seconds',
      },
    );

    await browser.execute(() => { (window as any).lr.login(); });
  }

  // eslint-disable-next-line class-methods-use-this
  async completeLogin(browser: WebdriverIO.Browser): Promise<void> {
    // The IdP redirects to /callback which exchanges the code and
    // navigates back to the page the login started from.
    await browser.waitUntil(
      async () => (await browser.getUrl()).includes('/index.html'),
      {
        timeout: 30000,
        timeoutMsg: 'Was not redirected back to the test app after login',
      },
    );

    await browser.waitUntil(
      async () => browser.executeAsync(async (done) => {
        const { lr } = window as any;
        done(lr ? await lr.isAuthenticated() : false);
      }),
      {
        timeout: 30000,
        timeoutMsg: 'The SDK did not report an authenticated session after login',
      },
    );
  }
}
