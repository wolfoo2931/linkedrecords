import pg from 'pg';
import { expect } from 'chai';

const pgPool = new pg.Pool({ max: 2 });

// eslint-disable-next-line import/prefer-default-export
export async function expectFactToExists(fact: [string, string, string]) {
  const results = await pgPool.query('SELECT * FROM facts WHERE subject=$1 AND predicate=$2 AND object=$3', fact);

  expect(results.rows.length).to.be.greaterThan(0);
}

export async function expectFactToNotExists(fact: [string, string, string]) {
  const results = await pgPool.query('SELECT * FROM facts WHERE subject=$1 AND predicate=$2 AND object=$3', fact);

  expect(results.rows.length).to.eq(0);
}

export async function expectNotToBeAbleToWriteAttribute(attributeId, client) {
  const attributeWithAccess = await client.Attribute.createKeyValue({ name: 'anAttributeWithAccess' });
  const serverURL = await attributeWithAccess.getServerURL();
  const clientId = await attributeWithAccess.getClientId();
  const { actorId } = client;

  const update = (lr, sURL, cId, actId, aId) => fetch(`${sURL}attributes/${aId}?clientId=${cId}`, {
    credentials: 'include',
    method: 'PATCH',
    body: JSON.stringify({
      clientId: cId,
      actorId: actId,
      facts: [],
      body: { UPDATED: 'VALUE' },
    }),
  }).then((r) => r.status);

  const authorizedContent = await client.do(
    update,
    serverURL,
    clientId,
    actorId,
    attributeWithAccess.id,
  );

  const unauthorizedContent = await client.do(
    update,
    serverURL,
    clientId,
    actorId,
    attributeId,
  );

  expect(authorizedContent).to.eql(200);
  expect(unauthorizedContent).to.eql(401);
}

export async function expectNotToBeAbleToReadAttribute(attributeId, client) {
  const attributeWithAccess = await client.Attribute.createKeyValue({ name: 'anAttributeWithAccess' });
  const serverURL = await attributeWithAccess.getServerURL();
  const clientId = await attributeWithAccess.getClientId();

  expect((await client.Fact.findAll({
    subject: [attributeId],
  })).length).to.eql(0);

  expect((await client.Fact.findAll({
    object: [attributeId],
  })).length).to.eql(0);

  const noAccessAttr = await client.Attribute.find(attributeId);
  const accessAttr = await client.Attribute.find(attributeWithAccess.id);

  expect(!!noAccessAttr).to.eql(false);
  expect(!!accessAttr).to.eql(true);

  const authorizedContent = await client.do(
    (lr, sURL, cId, aId) => fetch(`${sURL}attributes/${aId}?clientId=${cId}`, { credentials: 'include' }).then((r) => r.text()),
    serverURL,
    clientId,
    attributeWithAccess.id,
  );

  const unauthorizedContent = await client.do(
    (lr, sURL, cId, aId) => fetch(`${sURL}attributes/${aId}?clientId=${cId}`, { credentials: 'include' }).then((r) => r.text()),
    serverURL,
    clientId,
    attributeId,
  );

  expect(authorizedContent).to.match(/anAttributeWithAccess/);
  expect(unauthorizedContent).to.match(/Unauthorized/);
}
