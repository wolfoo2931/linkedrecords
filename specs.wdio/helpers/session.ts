/* eslint-disable max-classes-per-file */
/* eslint-disable no-eval */
import { multiremote } from 'webdriverio';
import pg from 'pg';
import WdioRemote from './wdio_remote';
import AttributesRepository from '../../src/browser_sdk/attributes_repository';
import FactsRepository from '../../src/browser_sdk/facts_repository';

const pgPool = new pg.Pool({ max: 2 });

const capabilities = {
  browserName: 'chrome',
  'goog:chromeOptions': {
    w3c: false,
    args: ['headless', 'disable-gpu', 'window-size=1920,1080'],
  },
};

export default class Session {
  browser: WebdriverIO.Browser;

  Attribute?: AttributesRepository;

  Fact?: FactsRepository;

  static async getSessions(count: number): Promise<InitilizedSession[]> {
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

    const result = sessions.map((s) => new Session(s));
    await Promise.all(result.map((s) => s.initLinkedRecord()));

    return result as InitilizedSession[];
  }

  static async getOneSession(): Promise<InitilizedSession> {
    const session = await this.getSessions(1);

    if (!session[0]) {
      throw new Error('Unknown error when initializing LinkedRecord test session');
    }

    return session[0];
  }

  static async getTwoSessions(): Promise<[InitilizedSession, InitilizedSession]> {
    const session = await this.getSessions(2);

    if (!session[0] || !session[1]) {
      throw new Error('Unknown error when initializing LinkedRecord test session');
    }

    return [
      session[0],
      session[1],
    ];
  }

  static async getThreeSessions()
  : Promise<[InitilizedSession, InitilizedSession, InitilizedSession]> {
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

  static async truncateDB() {
    await pgPool.query('TRUNCATE facts;');
  }

  constructor(browser) {
    this.browser = browser;
  }

  async initLinkedRecord() {
    const remote = new WdioRemote(this.browser);
    this.Attribute = (await remote.execute(
      () => (window as any).lr.Attribute,
    )) as AttributesRepository;

    this.Fact = (await remote.execute(
      () => (window as any).lr.Fact,
    )) as FactsRepository;
  }

  async getActorId() {
    const remote = new WdioRemote(this.browser);

    return remote.execute(
      () => (window as any).lr.actorId,
    );
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

class InitilizedSession extends Session {
  Attribute: AttributesRepository;

  Fact: FactsRepository;

  constructor(browser, attr, fact) {
    super(browser);
    this.Attribute = attr;
    this.Fact = fact;
  }
}
