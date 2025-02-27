import { expect } from 'chai';
import Session from '../helpers/session';

describe('quota', () => {
  beforeEach(Session.truncateDB);
  afterEach(Session.afterEach);
  after(Session.deleteBrowsers);

  it('is possible to retrieve the quota information of a user', async () => {
    const client = await Session.getOneSession();

    const quota = await client.getQuota();

    console.log(quota);

    expect(quota).to.not.eq(undefined);
  });

  // it('is possible to update the quota via admin API', () => {

  // });
});
