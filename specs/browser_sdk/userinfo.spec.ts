import { expect } from 'chai';
import { createClient, cleanupClients, truncateDB } from '../helpers';

describe('User Info', () => {
  beforeEach(truncateDB);
  afterEach(cleanupClients);

  describe('getCurrentUserEmail()', () => {
    it('returns the email of the currently logged in user', async () => {
      const [client] = await createClient();

      const email = await client.getCurrentUserEmail();

      expect(email).to.equal('testuser-1@example.com');
    });
  });
});
