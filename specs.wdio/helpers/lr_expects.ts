/* eslint-disable no-await-in-loop */
import { expect } from 'chai';
import { queryFactCount } from './testapp_client';
import { InitializedSession } from './session';

function clearCache(client: InitializedSession) {
  return client.do((lr: any) => {
    // eslint-disable-next-line no-param-reassign
    lr.Record.recordCache = {};
  });
}

// eslint-disable-next-line import/prefer-default-export
export async function expectFactToExists(fact: [string, string, string]) {
  expect(await queryFactCount(fact[0], fact[1], fact[2])).to.be.greaterThan(0);
}

export async function expectFactToNotExists(fact: [string, string, string]) {
  const count = await queryFactCount(fact[0], fact[1], fact[2]);
  if (count !== 0) {
    console.error('expectFactToNotExists but it does:', fact);
  }
  expect(count).to.eq(0);
}

export async function expectNotToBeAbleToWriteRecord(attributeId, client) {
  const attributeWithAccess = await client.Record.createKeyValue({ name: 'anAttributeWithAccess' });
  const serverURL = await attributeWithAccess.getServerURL();
  const clientId = await attributeWithAccess.getClientId();
  const { actorId } = client;

  // Raw fetch on purpose (bypasses the SDK); authenticates like the SDK
  // does: bearer token when one is available (public mode), cookies otherwise.
  // NOTE: this function is stringified and eval'd in the browser, keep it
  // free of TypeScript-only syntax.
  const update = async (lr, sURL, cId, actId, aId) => {
    const token = await lr.getAccessToken();

    return fetch(`${sURL}attributes/${aId}?clientId=${cId}`, {
      credentials: token ? 'same-origin' : 'include',
      method: 'PATCH',
      headers: token
        ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        : { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: cId,
        actorId: actId,
        facts: [],
        change: [{ UPDATED: 'VALUE' }],
      }),
    }).then((r) => r.status);
  };

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
  expect(unauthorizedContent).to.eql(403);
}

export async function expectNotToBeAbleToReadOrWriteRecord(attributeId, client) {
  const attributeWithAccess = await client.Record.createKeyValue({ name: 'anAttributeWithAccess' });
  const serverURL = await attributeWithAccess.getServerURL();
  const clientId = await attributeWithAccess.getClientId();

  expect((await client.Fact.findAll({
    subject: [attributeId],
  })).length).to.eql(0);

  expect((await client.Fact.findAll({
    object: [attributeId],
  })).length).to.eql(0);

  await clearCache(client);
  const noAccessAttr = await client.Record.find(attributeId);
  const accessAttr = await client.Record.find(attributeWithAccess.id);

  expect(!!noAccessAttr).to.eql(false);
  expect(!!accessAttr).to.eql(true);

  // Raw fetch on purpose (bypasses the SDK); authenticates like the SDK
  // does: bearer token when one is available (public mode), cookies otherwise.
  // NOTE: this function is stringified and eval'd in the browser, keep it
  // free of TypeScript-only syntax.
  const read = async (lr, sURL, cId, aId) => {
    const token = await lr.getAccessToken();

    return fetch(`${sURL}attributes/${aId}?clientId=${cId}`, {
      credentials: token ? 'same-origin' : 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then((r) => r.text());
  };

  const authorizedContent = await client.do(
    read,
    serverURL,
    clientId,
    attributeWithAccess.id,
  );

  const unauthorizedContent = await client.do(
    read,
    serverURL,
    clientId,
    attributeId,
  );

  expect(authorizedContent).to.match(/anAttributeWithAccess/);
  expect(unauthorizedContent).to.match(/Forbidden/);

  await expectNotToBeAbleToWriteRecord(attributeId, client);
}

export async function expectNotToBeAbleToUseAsSubject(attributeId, client) {
  const relations = ['belongsTo', '$isMemberOf', '$isHostOf', '$isAccountableFor', '$isATermFor'];

  for (let index = 0; index < relations.length; index += 1) {
    const attributeWithAccessA = await client.Record.createKeyValue({});
    const attributeWithAccessB = await client.Record.createKeyValue({});
    const relation = relations[index];

    if (!relation) {
      throw new Error('relations[index] should not be undefined.');
    }

    if (relation !== '$isATermFor') {
      await client.Fact.createAll([
        [attributeWithAccessA.id, relation, attributeWithAccessB.id],
      ]);

      await expectFactToExists([attributeWithAccessA.id, relation, attributeWithAccessB.id]);
    }

    await client.Fact.createAll([
      [attributeId, relation, attributeWithAccessB.id],
    ]);

    await expectFactToNotExists([attributeId, relation, attributeWithAccessB.id]);
  }
}

export async function expectNotToBeAbleToUseAsObject(attributeId, client) {
  const relations = ['belongsTo', '$isMemberOf', '$isHostOf', '$isAccountableFor', '$isATermFor'];

  for (let index = 0; index < relations.length; index += 1) {
    const attributeWithAccessA = await client.Record.createKeyValue({});
    const attributeWithAccessB = await client.Record.createKeyValue({});
    const relation = relations[index];

    if (!relation) {
      throw new Error('relations[index] should not be undefined.');
    }

    if (relation !== '$isATermFor') {
      await client.Fact.createAll([
        [attributeWithAccessB.id, relation, attributeWithAccessA.id],
      ]);

      await expectFactToExists([attributeWithAccessB.id, relation, attributeWithAccessA.id]);
    }

    await client.Fact.createAll([
      [attributeWithAccessB.id, relation, attributeId],
    ]);

    await expectFactToNotExists([attributeWithAccessB.id, relation, attributeId]);
  }
}
