import IdpAdapter from './types';

export default class Auth0 implements IdpAdapter {
  // eslint-disable-next-line class-methods-use-this
  async login(browser: WebdriverIO.Browser, email: string, password: string): Promise<void> {
    await browser.$('input[name=username]').waitForDisplayed({ timeout: 100000 });

    await (await browser.$('input[name=username]')).setValue(email);
    await (await browser.$('input[name=password]')).setValue(password);
    await (await browser.$('form button[type=submit][name=action][data-action-button-primary="true"]')).click();

    // Auth0 shows a consent screen on first login of a user for an app
    // (always for localhost callbacks); it reuses the primary button markup.
    try {
      const consentBtn = await browser.$('form button[type=submit][name=action][data-action-button-primary="true"]');

      if (await consentBtn.isExisting()) {
        await consentBtn.click();
      }
    } catch (ex) {
      // do nothing
    }
  }
}
