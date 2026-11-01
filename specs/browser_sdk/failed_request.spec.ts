import { expect } from 'chai';
import { vi } from 'vitest';
import { createClient, cleanupClients, truncateDB } from '../helpers';

// #227: fetch() resolves to false when a request fails. The SDK methods
// must not call .json() on that.
describe('a failed request', () => {
  beforeEach(truncateDB);
  afterEach(() => {
    vi.restoreAllMocks();
    return cleanupClients();
  });

  async function clientThatLosesTheConnection() {
    const [client] = await createClient();
    const lostConnections: unknown[] = [];

    // known before the connection goes, as in a running app
    await client.ensureUserIdIsKnown();
    client.setConnectionLostHandler((err) => lostConnections.push(err));
    vi.spyOn(window, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    return { client, lostConnections };
  }

  it('gives Fact.findAll() an empty list', async () => {
    const { client, lostConnections } = await clientThatLosesTheConnection();

    expect(await client.Fact.findAll({ predicate: ['isA'] })).to.eql([]);
    expect(lostConnections.length).to.equal(1);
  });

  it('gives Record.findAll() nothing for each query', async () => {
    const { client, lostConnections } = await clientThatLosesTheConnection();

    const result = await client.Record.findAll({
      one: 'kv-00000000-0000-0000-0000-000000000000',
      many: [['$it', 'isA', 'Book']],
    });

    expect(result.one).to.equal(null);
    expect(result.many).to.eql([]);
    expect(lostConnections.length).to.equal(1);
  });

  it('gives getQuota() and getUserIdByEmail() undefined', async () => {
    const { client } = await clientThatLosesTheConnection();

    expect(await client.getQuota()).to.equal(undefined);
    expect(await client.getUserIdByEmail('nobody@example.com')).to.equal(undefined);
  });
});
