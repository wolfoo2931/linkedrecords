/* eslint-disable max-classes-per-file */
/* eslint-disable no-eval */
import { multiremote } from 'webdriverio';
import WdioRemote from './wdio_remote';
import RecordsRepository from '../../src/browser_sdk/records_repository';
import FactsRepository from '../../src/browser_sdk/facts_repository';
import * as testappClient from './testapp_client';
import getIdpAdapter from './idp';
import getAuthModeStrategy from './auth_mode';

type RecordsRepositoryType = RecordsRepository;

const reuseBrowsers = process.env['REUSE_TEST_BROWSERS'] === 'true';

const capabilities = {
  browserName: 'chrome',
  // WDIO v9 defaults to WebDriver BiDi protocol which has significant performance overhead
  // for high-frequency executeAsync calls used in our load tests. Forcing classic protocol
  // restores v8 performance characteristics.
  'wdio:enforceWebDriverClassic': true,
  'goog:chromeOptions': {
    args: ['--headless'],
  },
};

const allSessionsToBeTerminated: InitializedSession[] = [];
const theCachedSessions: InitializedSession[] = [];

// One multiremote() call per browser instead of one call listing every capability: multiremote()
// launches every capability it's given CONCURRENTLY (it's a Promise.all internally over one
// chromedriver/Chrome startup per name - see node_modules/webdriverio/build/node.js's
// `multiremote` function). Starting several headless Chrome processes in the same instant is
// resource-intensive enough that chromedriver occasionally fails the handshake for one of them
// with a generic "unknown error" on POST /session. We don't need true multiremote parallelism
// here (each resulting instance is only ever driven individually via getInstance()), so creating
// one single-capability multiremote() per browser, one at a time, avoids that concurrent-launch
// race entirely.
async function createBrowser(name: string): Promise<Awaited<ReturnType<typeof multiremote>>> {
  return multiremote({ [name]: { capabilities } });
}

function getTestUserEmail(index: string): string {
  const testUsers = process.env['TEST_USERS'];

  if (!testUsers) {
    throw new Error('You need to provide the TEST_USERS environment variable which contains a comma separated list of test user emails, e.g. TEST_USERS="user+1@example.com,user+2@example.com"');
  }

  const emails = testUsers.split(',').map((email) => email.trim()).filter((email) => email);
  const email = emails[parseInt(index, 10) - 1];

  if (!email) {
    throw new Error(`TEST_USERS only contains ${emails.length} emails but the test requested test user number ${index}`);
  }

  return email;
}
export default class Session {
  browser: WebdriverIO.Browser;

  email: string;

  Record?: RecordsRepositoryType;

  Fact?: FactsRepository;

  getUserIdByEmail?: (email: string) => Promise<string>;

  getMembersOf?: (nodeId: string) => Promise<{ id: string, username: string }[]>;

  getQuota?: (nodeId?: string) => Promise<any>;

  getCurrentUserEmail?: () => Promise<string | undefined>;

  static async getSession(
    name: string,
    browser: WebdriverIO.MultiRemoteBrowser,
  ): Promise<InitializedSession> {
    const allUsersPwd = process.env['TEST_USERS_PWD'];
    const frontendBaseURL = process.env['FRONTEND_BASE_URL'];
    const index = name.replace('browser', '');
    const email = getTestUserEmail(index);
    const session = await browser.getInstance(name);
    const idp = getIdpAdapter();
    const authMode = getAuthModeStrategy();

    if (!allUsersPwd) {
      throw new Error('You need to provide the TEST_USERS_PWD environment variable which contains the Password for all test users');
    }

    await session.url(`${frontendBaseURL}/index.html`);
    await authMode.initiateLogin(session);
    await idp.login(session, email, allUsersPwd);
    await authMode.completeLogin(session);

    const lrSession = new Session(session, email);

    await lrSession.initLinkedRecord();

    return lrSession as InitializedSession;
  }

  // Logins happen sequentially (not Promise.all) and, when reused, are grown lazily one at
  // a time rather than all 4 upfront - both to avoid the same problem in different guises:
  //
  // - Concurrent logins mean several password-stage hashes hit the IdP at the same instant;
  //   against a loaded real IdP (the hermetic Authentik container fighting Docker-on-Mac's
  //   VM overhead, or several CI workers sharing one runner) that burst can blow past even
  //   generous per-login timeouts.
  // - But logging in all 4 upfront regardless of what's asked for shifts that cost onto
  //   whichever test happens to run first: WebdriverIO's command wrapper races every command
  //   against the *current mocha test's own remaining timeout budget*
  //   (@wdio/utils executeAsync, see node_modules/@wdio/utils/build/index.js), so a test that
  //   only needs 2 sessions but ends up paying for 4 sequential logins can blow its own
  //   mochaOpts.timeout and fail with a bare "Error: Timeout" that has nothing to do with
  //   that test's own logic.
  //
  // Growing the cache one login at a time means each test only ever pays for the sessions it
  // newly needs beyond what's already cached, spreading the one-time login cost across
  // whichever tests actually ask for more instead of dumping it all on the first one.
  static async getSessions(count: number): Promise<InitializedSession[]> {
    if (!reuseBrowsers) {
      const browsers = Array.from({ length: count }, (_, index) => `browser${index + 1}`);
      const sessions: InitializedSession[] = [];

      for (let i = 0; i < browsers.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const browser = await createBrowser(browsers[i]!);
        // eslint-disable-next-line no-await-in-loop
        sessions.push(await this.getSession(browsers[i]!, browser));
      }

      allSessionsToBeTerminated.push(...sessions);
      return sessions;
    }

    if (theCachedSessions.length >= count) {
      return theCachedSessions.slice(0, count);
    }

    for (let i = theCachedSessions.length; i < count; i += 1) {
      const name = `browser${i + 1}`;
      // eslint-disable-next-line no-await-in-loop
      const browser = await createBrowser(name);
      // eslint-disable-next-line no-await-in-loop
      const session = await this.getSession(name, browser);
      theCachedSessions.push(session);
      allSessionsToBeTerminated.push(session);
    }

    return theCachedSessions.slice(0, count);
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
      await testappClient.deleteFacts();
    }
  }

  static async getFactCount() {
    return testappClient.getFactCount();
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

    // Wait for window.lr to be initialized before accessing it. 30s (not 10s): against a
    // real IdP (e.g. the hermetic Authentik container used in CI/local dev) a single login
    // - password-stage hashing plus the OAuth round trip - can be noticeably slower than the
    // near-instant dev-oidc/auth0 flows this used to run against exclusively, especially
    // under CPU contention from whatever else is running (see getSessions()).
    await this.browser.waitUntil(
      async () => this.browser.execute(() => typeof (window as any).lr !== 'undefined'),
      {
        timeout: 30000,
        timeoutMsg: 'initLinkedRecord: window.lr was not initialized within 30 seconds',
      },
    );

    this.Record = (await remote.execute(
      () => (window as any).lr.Record,
    )) as RecordsRepositoryType;

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

    this.getCurrentUserEmail = () => remote.execute(
      () => (window as any).lr.getCurrentUserEmail(),
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
  Record: RecordsRepositoryType;

  Fact: FactsRepository;

  getUserIdByEmail: (email: string) => Promise<string>;

  getMembersOf: (nodeId: string) => Promise<{ id: string, username: string }[]>;

  getQuota: (nodeId?: string) => Promise<any>;

  getCurrentUserEmail: () => Promise<string | undefined>;

  constructor(
    browser,
    attr,
    fact,
    getUserIdByEmail,
    getMembersOf,
    getQuota,
    getCurrentUserEmail,
    email,
  ) {
    super(browser, email);
    this.Record = attr;
    this.Fact = fact;
    this.getUserIdByEmail = getUserIdByEmail;
    this.getMembersOf = getMembersOf;
    this.getQuota = getQuota;
    this.getCurrentUserEmail = getCurrentUserEmail;
  }
}
