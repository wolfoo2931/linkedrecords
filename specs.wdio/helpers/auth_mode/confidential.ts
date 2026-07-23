import AuthModeStrategy from './types';

export default class ConfidentialClientMode implements AuthModeStrategy {
  // eslint-disable-next-line class-methods-use-this
  async initiateLogin(browser: WebdriverIO.Browser): Promise<void> {
    // The test app's login link points to /login, which the static server
    // proxies to the LinkedRecords server where express-openid-connect
    // redirects to the IdP.
    await browser.$('a').click();
  }

  // eslint-disable-next-line class-methods-use-this
  async completeLogin(): Promise<void> {
    // Nothing to do: the IdP redirects to /callback (proxied to the server),
    // which sets the session cookie and redirects back to the test app.
  }
}
