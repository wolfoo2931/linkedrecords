import { expect } from 'chai';
import { vi } from 'vitest';
import { RequestFailedError } from '../../src/browser_sdk';
import {
  createClient,
  cleanupClients,
  truncateDB,
  waitFor,
} from '../helpers';

// #227: fetch() resolves to false when a request fails. The read methods
// reject with a RequestFailedError then, instead of calling .json() on false
// ("….json is not a function") or pretending the result is empty.
describe('a failed request', () => {
  beforeEach(truncateDB);
  afterEach(() => {
    vi.restoreAllMocks();
    return cleanupClients();
  });

  const originalFetch = window.fetch.bind(window);

  // The connection fails for the requests whose URL matches, with the
  // message the given browser uses.
  function loseTheConnection(matches: (url: string) => boolean = () => true, message = 'Failed to fetch') {
    vi.spyOn(window, 'fetch').mockImplementation((input, init) => {
      const url = input instanceof Request ? input.url : String(input);

      return matches(url)
        ? Promise.reject(new TypeError(message))
        : originalFetch(input, init);
    });
  }

  async function client() {
    const [lr] = await createClient();
    const lostConnections: unknown[] = [];

    // known before the connection goes, as in a running app
    await lr.ensureUserIdIsKnown();
    lr.setConnectionLostHandler((err) => lostConnections.push(err));

    return { lr, lostConnections };
  }

  async function rejection(promise: Promise<unknown>) {
    try {
      await promise;
    } catch (ex) {
      return ex;
    }

    return undefined;
  }

  it('makes Fact.findAll() reject with a RequestFailedError', async () => {
    const { lr, lostConnections } = await client();
    loseTheConnection();

    const error = await rejection(lr.Fact.findAll({ predicate: ['isA'] }));

    expect(error).to.be.instanceOf(RequestFailedError);
    expect((error as Error).name).to.equal('RequestFailedError');
    expect((error as RequestFailedError).request).to.equal('GET /facts');
    expect(lostConnections.length).to.equal(1);
  });

  it('makes Record.findAll(), getQuota() and getUserIdByEmail() reject with a RequestFailedError', async () => {
    const { lr } = await client();
    loseTheConnection();

    expect(await rejection(lr.Record.findAll({ many: [['$it', 'isA', 'Book']] }))).to.be.instanceOf(RequestFailedError);
    expect(await rejection(lr.getQuota())).to.be.instanceOf(RequestFailedError);
    expect(await rejection(lr.getUserIdByEmail('nobody@example.com'))).to.be.instanceOf(RequestFailedError);
  });

  it('asks for the quota again once the connection is back', async () => {
    const { lr } = await client();
    loseTheConnection();
    await rejection(lr.getQuota());
    vi.restoreAllMocks();

    expect((await lr.getQuota()).usedStorage).to.be.a('number');
  });

  ['Load failed', 'NetworkError when attempting to fetch resource.'].forEach((message) => {
    it(`calls the connection lost handler for "${message}" (Safari, Firefox)`, async () => {
      const { lr, lostConnections } = await client();
      loseTheConnection(() => true, message);

      await rejection(lr.Fact.findAll({ predicate: ['isA'] }));

      expect(lostConnections.length).to.equal(1);
    });
  });

  it('keeps the last result of a query subscription', async () => {
    const { lr } = await client();
    const results: unknown[][] = [];

    await lr.Fact.createAll([['Book', '$isATermFor', 'a book']]);
    await lr.Record.createKeyValue({ title: 'the first book' }, [['isA', 'Book']]);

    await lr.Record.subscribeToQuery({ books: [['$it', 'isA', 'Book']] }, ({ books }) => {
      results.push(books);
    });

    await waitFor(() => results.length === 1);
    expect(results[0]).to.have.lengthOf(1);

    // only the query fails, so the change below reaches the server and the
    // subscription asks again
    let failedQueries = 0;
    loseTheConnection((url) => {
      const isQuery = url.includes('/records?query=');
      failedQueries += isQuery ? 1 : 0;
      return isQuery;
    });
    await lr.Record.createKeyValue({ title: 'the second book' }, [['isA', 'Book']]);
    await waitFor(() => failedQueries > 0);
    await new Promise((resolve) => { setTimeout(resolve, 500); });

    expect(results).to.have.lengthOf(1);
  });
});
