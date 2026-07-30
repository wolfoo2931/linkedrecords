import IdpAdapter from './types';

// The built-in mock OIDC provider (src/dev-oidc, enabled via AUTH_DEV_MODE).
// Its login page accepts any email address without a password, so the
// password argument is unused.
export default class DevOidc implements IdpAdapter {
  // eslint-disable-next-line class-methods-use-this
  async login(browser: WebdriverIO.Browser, email: string): Promise<void> {
    await (await browser.$('form.custom-login input[name=custom_email]')).setValue(email);
    await (await browser.$('form.custom-login button[type=submit]')).click();
  }
}
