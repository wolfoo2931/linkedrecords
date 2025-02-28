import { expect } from 'chai';
import pg from 'pg';
import Session from '../helpers/session';

const pgPool = new pg.Pool({ max: 2 });
const mb = 1048576;

async function setQuota(nodeId, totalStorageAvailable) {
  await pgPool.query('INSERT INTO quota_events (node_id, total_storage_available) VALUES ($1, $2)', [
    nodeId,
    totalStorageAvailable,
  ]);
}

describe('quota', () => {
  beforeEach(Session.truncateDB);
  afterEach(Session.afterEach);
  after(Session.deleteBrowsers);

  it('is possible to retrieve the quota information of a user', async () => {
    const client = await Session.getOneSession();
    await setQuota(await client.getActorId(), 1 * mb);

    const quota = await client.getQuota();

    expect(quota).to.be.a('object');
    expect(quota.nodeId).to.eq(await client.getActorId());
    expect(quota.remainingStorageAvailable).to.be.a('number');
    expect(quota.totalStorageAvailable).to.be.a('number');

    expect(quota.totalStorageAvailable).to.be.eq(1 * mb);
    expect(quota.remainingStorageAvailable).to.be.at.most(quota.totalStorageAvailable);
  });

  it('will block creation of attributes when no storage left', async () => {
    const client = await Session.getOneSession();
    await client.Fact.createAll([
      ['Thing', '$isATermFor', 'something'],
    ]);

    await setQuota(await client.getActorId(), Math.ceil(0.1 * mb));

    await client.Attribute.create('keyValue', { x: 'x'.repeat(90 * 1024) }, [
      ['isA', 'Thing'],
    ]);

    const beforeQuotaViolation = await client.getQuota();

    await client.Attribute.create('keyValue', { x: 'x'.repeat(90 * 1024) }, [
      ['isA', 'Thing'],
    ]);

    const afterQuotaViolation = await client.getQuota();

    const { things } = await client.Attribute.findAll({
      things: [
        ['$it', 'isA', 'Thing'],
      ],
    });

    expect(things).to.be.an('array').with.lengthOf(1);

    expect(beforeQuotaViolation.remainingStorageAvailable)
      .to.be.eq(afterQuotaViolation.remainingStorageAvailable);
  });

  it('will block change of attributes when no storage left', async () => {
    const client = await Session.getOneSession();
    await setQuota(await client.getActorId(), Math.ceil(0.1 * mb));

    const attribute = await client.Attribute.createKeyValue({ x: 'x'.repeat(90 * 1024) }, []);

    await attribute.patch({ y: 'y' });

    await browser.pause(500);

    let readFromDb = await client.Attribute.find(attribute.id!);
    let value = await readFromDb?.getValue();

    expect(Object.keys(value)).to.be.an('array').of.length(2);

    const beforeQuotaViolation = await client.getQuota();

    await attribute.patch({ z: 'z'.repeat(90 * 1024) });

    await browser.pause(500);

    const afterQuotaViolation = await client.getQuota();

    readFromDb = await client.Attribute.find(attribute.id!);
    value = await readFromDb?.getValue();

    expect(Object.keys(value)).to.be.an('array').of.length(2);

    expect(beforeQuotaViolation.remainingStorageAvailable)
      .to.be.eq(afterQuotaViolation.remainingStorageAvailable);
  });

  // it.only('will ... when there is no quota assigned to the nodeId', async () => {
  //   const client = await Session.getOneSession();
  //   const attribute = await client.Attribute.create('keyValue', { });

  //   console.log(attribute.id);
  // });

  // it('is possible to update the quota via admin API', () => {

  // });
});
