/* eslint-disable max-classes-per-file */
/* eslint-disable no-eval */
import { multiremote } from 'webdriverio';
import pg from 'pg';
import WdioRemote from './wdio_remote';
import AttributesRepository from '../../src/browser_sdk/attributes_repository';
import FactsRepository from '../../src/browser_sdk/facts_repository';

const pgPool = new pg.Pool({ max: 2 });
const reuseBrowsers = process.env['REUSE_TEST_BROWSERS'] === 'true';

const capabilities = {
  browserName: 'chrome',
  'goog:chromeOptions': {
    args: ['headless'],
  },
};

const allSessionsToBeTerminated: InitializedSession[] = [];
let theCachedSessions;
export default class Session {
  browser: WebdriverIO.Browser;

  email: string;

  Attribute?: AttributesRepository;

  Fact?: FactsRepository;

  getUserIdByEmail?: (email: string) => Promise<string>;

  getMembersOf?: (nodeId: string) => Promise<{ id: string, username: string }[]>;

  getQuota?: (nodeId?: string) => Promise<any>;

  static async getSession(
    name: string,
    browser: WebdriverIO.MultiRemoteBrowser,
  ): Promise<InitializedSession> {
    const allUsersPwd = process.env['TEST_USERS_PWD'];
    const frontendBaseURL = process.env['FRONTEND_BASE_URL'];
    const index = name.replace('browser', '');
    const session = await browser.getInstance(name);

    await session.url(`${frontendBaseURL}/index.html`);
    await session.$('a').click();

    if (!allUsersPwd) {
      throw new Error('You need to provide the TEST_USERS_PWD environment variable which contains the Password for all test users');
    }

    await (await session.$('input[name=username]')).setValue(`wolfoo2931+${index}@gmail.com`);
    await (await session.$('input[name=password]')).setValue(allUsersPwd);
    await (await session.$('form button[type=submit][name=action][data-action-button-primary="true"]')).click();

    try {
      const consentBtn = await session.$('form button[type=submit][name=action][data-action-button-primary="true"]');

      if (await consentBtn.isExisting()) {
        await consentBtn.click();
      }
    } catch (ex) {
      // do nothing
    }

    const lrSession = new Session(session, `wolfoo2931+${index}@gmail.com`);

    await lrSession.initLinkedRecord();

    return lrSession as InitializedSession;
  }

  static async getSessions(count: number): Promise<InitializedSession[]> {
    if (theCachedSessions && reuseBrowsers) {
      return theCachedSessions;
    }

    const mrConfig = {};
    const browsers = Array.from({ length: reuseBrowsers ? 4 : count }, (_, index) => `browser${index + 1}`);

    browsers.forEach((name) => {
      mrConfig[name] = { capabilities };
    });

    const browser = await multiremote(mrConfig);

    theCachedSessions = await Promise.all(browsers.map((name) => this.getSession(name, browser)));
    allSessionsToBeTerminated.push(...theCachedSessions);
    return theCachedSessions;
  }

  static async getOneSession(): Promise<InitializedSession> {
    const session = await this.getSessions(1);

    if (!session[0]) {
      throw new Error('Unknown error when initializing LinkedRecord test session');
    }

    return session[0];
  }

  static async getTwoSessions(): Promise<[InitializedSession, InitializedSession]> {
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
  : Promise<[InitializedSession, InitializedSession, InitializedSession]> {
    const session = await this.getSessions(3);

    if (!session[0] || !session[1] || !session[2]) {
      throw new Error('Unknown error when initializing LinkedRecord test session');
    }

    return [
      session[0],
      session[1],
      session[2],
    ];
  }

  static async getFourSessions()
  : Promise<[InitializedSession, InitializedSession, InitializedSession, InitializedSession]> {
    const session = await this.getSessions(4);

    if (!session[0] || !session[1] || !session[2] || !session[3]) {
      throw new Error('Unknown error when initializing LinkedRecord test session');
    }

    return [
      session[0],
      session[1],
      session[2],
      session[3],
    ];
  }

  static async truncateDB() {
    if (process.env['NO_DB_TRUNCATE_ON_TEST'] !== 'true') {
      await pgPool.query('TRUNCATE facts;');
      await pgPool.query('TRUNCATE users_fact_boxes;');
      await pgPool.query('TRUNCATE quota_events;');
    }
  }

  static async getFactCount() {
    const result = await pgPool.query('SELECT count(*) as count FROM facts;');

    return parseInt(result.rows[0].count, 10);
  }

  static async afterEach() {
    if (reuseBrowsers) {
      return;
    }

    await Session.deleteBrowsers();
  }

  static async deleteBrowsers() {
    while (allSessionsToBeTerminated.length) {
      const s = allSessionsToBeTerminated.pop();

      if (s) {
        s.browser.deleteSession();
      }
    }
  }

  constructor(browser, email) {
    this.browser = browser;
    this.email = email;
  }

  async initLinkedRecord() {
    const remote = new WdioRemote(this.browser);

    // Wait for window.lr to be initialized before accessing it
    await this.browser.waitUntil(
      async () => this.browser.execute(() => typeof (window as any).lr !== 'undefined'),
      {
        timeout: 10000,
        timeoutMsg: 'window.lr was not initialized within 10 seconds',
      },
    );

    this.Attribute = (await remote.execute(
      () => (window as any).lr.Attribute,
    )) as AttributesRepository;

    this.Fact = (await remote.execute(
      () => (window as any).lr.Fact,
    )) as FactsRepository;

    this.getUserIdByEmail = (email: string) => remote.execute(
      (m) => (window as any).lr.getUserIdByEmail(m),
      email,
    );

    this.getMembersOf = (nodeId: string) => remote.execute(
      (n) => (window as any).lr.getMembersOf(n),
      nodeId,
    );

    this.getQuota = (nodeId?: string) => remote.execute(
      (x) => (window as any).lr.getQuota(x),
      nodeId,
    );
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

export class InitializedSession extends Session {
  Attribute: AttributesRepository;

  Fact: FactsRepository;

  getUserIdByEmail: (email: string) => Promise<string>;

  getMembersOf: (nodeId: string) => Promise<{ id: string, username: string }[]>;

  getQuota: (nodeId?: string) => Promise<any>;

  constructor(browser, attr, fact, getUserIdByEmail, getMembersOf, getQuota, email) {
    super(browser, email);
    this.Attribute = attr;
    this.Fact = fact;
    this.getUserIdByEmail = getUserIdByEmail;
    this.getMembersOf = getMembersOf;
    this.getQuota = getQuota;
  }
}
