/* eslint-disable max-classes-per-file */
/* eslint-disable no-eval */
import { multiremote } from 'webdriverio';

const capabilities = {
  browserName: 'chrome',
  'goog:chromeOptions': {
    w3c: false,
    args: ['headless', 'disable-gpu', 'window-size=1920,1080'],
  },
};

class RemoteAttributeRepository {
  session: Session;

  constructor(session: Session) {
    this.session = session;
  }

  async create(
    attributeType: string,
    value: any,
    facts?: [ string?, string? ][],
  ): Promise<string> {
    return this.session.do(async (lr, _attributeType, _value, _facts) => {
      const attribute = await lr.Attribute.create(_attributeType, _value, _facts);
      const foundAttribute = await lr.Attribute.find(attribute.id!);
      return foundAttribute.id;
    }, attributeType, value, facts);
  }

  async expectToFind(attributeId: string) {
    const result = await this.session.do(async (lr, _attributeId) => {
      const attribute = await lr.Attribute.find(_attributeId);
      return attribute.id;
    }, attributeId);

    expect(result.length).toBe(39);
    expect(result).toEqual(attributeId);
  }

  async expectNotToFind(attributeId: string) {
    const result = await this.session.do(async (lr, _attributeId) => {
      const attribute = await lr.Attribute.find(_attributeId);

      if (attribute === undefined) {
        return undefined;
      }

      return attribute.id;
    }, attributeId);

    expect(result).toBe(null);
  }

  async findAndGetValue(attributeId: string) {
    return this.session.do(async (lr, _attributeId) => {
      const attribute = await lr.Attribute.find(_attributeId);

      if (attribute === undefined) {
        return undefined;
      }

      return attribute.getValue();
    }, attributeId);
  }

  async findAndSetValue(attributeId: string, value: any) {
    return this.session.do(async (lr, _attributeId, _value) => {
      const attribute = await lr.Attribute.find(_attributeId);
      await attribute.set(_value);
    }, attributeId, value);
  }
}

export default class Session {
  browser: WebdriverIO.Browser;

  Attribute: RemoteAttributeRepository;

  static async getSessions(count: number): Promise<Session[]> {
    const mrConfig = {};
    const browsers = Array.from({ length: count }, (_, index) => `browser${index + 1}`);
    const frontendBaseURL = process.env['FRONTEND_BASE_URL'];

    browsers.forEach((name) => {
      mrConfig[name] = { capabilities };
    });

    const browser = await multiremote(mrConfig);

    await browser.url(`${frontendBaseURL}/index.html`);
    await browser.$('a').click();

    const sessions = await Promise.all(browsers.map((name) => browser.getInstance(name)));

    if (!process.env['TEST_USERS_PWD']) {
      throw new Error('You need to provide the TEST_USERS_PWD environment variable which contains the Password for all test users');
    }

    const allUsersPwd = process.env['TEST_USERS_PWD'];

    await Promise.all(sessions.map(async (session, index) => {
      await (await session.$('input[name=username]')).setValue(`wolfoo2931+${index + 1}@gmail.com`);
      await (await session.$('input[name=password]')).setValue(allUsersPwd);
      await (await session.$('form button[type=submit][name=action][data-action-button-primary="true"]')).click();

      const consetBtn = await session.$('form button[type=submit][name=action][data-action-button-primary="true"]');

      if (await consetBtn.isExisting()) {
        await consetBtn.click();
      }
    }));

    return sessions.map((sess) => new Session(sess));
  }

  static async getOneSession(): Promise<Session> {
    const session = await this.getSessions(1);

    if (!session[0]) {
      throw new Error('Unknown error when initializing LinkedRecord test session');
    }

    return session[0];
  }

  static async getTwoSessions(): Promise<[Session, Session]> {
    const session = await this.getSessions(2);

    if (!session[0] || !session[1]) {
      throw new Error('Unknown error when initializing LinkedRecord test session');
    }

    return [
      session[0],
      session[1],
    ];
  }

  static async getThreeSessions(): Promise<[Session, Session, Session]> {
    const session = await this.getSessions(2);

    if (!session[0] || !session[1] || !session[2]) {
      throw new Error('Unknown error when initializing LinkedRecord test session');
    }

    return [
      session[0],
      session[1],
      session[2],
    ];
  }

  constructor(browser) {
    this.browser = browser;
    this.Attribute = new RemoteAttributeRepository(this);
  }

  async do<T = any>(script, ...rest): Promise<T> {
    return this.browser.executeAsync(async (...args) => {
      const fnStr = args.shift();
      const done = args.pop();
      const fn = eval(fnStr);
      const result = await fn((window as any).lr, ...args);
      done(result as T);
    }, `${script}`, ...rest);
  }
}
