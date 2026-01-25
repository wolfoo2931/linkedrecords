import { expect } from 'chai';
import Session from '../helpers/session';

describe('User Info', () => {
  beforeEach(Session.truncateDB);
  afterEach(Session.afterEach);
  after(Session.deleteBrowsers);

  describe('getCurrentUserEmail()', () => {
    it('returns the email of the currently logged in user', async () => {
      const [user] = await Session.getTwoSessions();

      const email = await user.getCurrentUserEmail();

      expect(email).to.equal(user.email);
    });

    it('caches the email for subsequent calls', async () => {
      const [user] = await Session.getTwoSessions();

      const email1 = await user.getCurrentUserEmail();
      const email2 = await user.getCurrentUserEmail();

      expect(email1).to.equal(email2);
      expect(email1).to.equal(user.email);
    });

    it('returns correct email for different users', async () => {
      const [user1, user2] = await Session.getTwoSessions();

      const email1 = await user1.getCurrentUserEmail();
      const email2 = await user2.getCurrentUserEmail();

      expect(email1).to.equal(user1.email);
      expect(email2).to.equal(user2.email);
      expect(email1).to.not.equal(email2);
    });
  });
});
