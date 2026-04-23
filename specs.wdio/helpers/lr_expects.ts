/* eslint-disable no-await-in-loop */
import { expect } from 'chai';

const testHelperBase = 'http://localhost:3001';

async function queryFactCount(fact: [string, string, string]): Promise<number> {
  const params = new URLSearchParams({ subject: fact[0], predicate: fact[1], object: fact[2] });
  const res = await fetch(`${testHelperBase}/queryFacts?${params}`);
  const { count } = await res.json() as { count: number };
  return count;
}

// eslint-disable-next-line import/prefer-default-export
export async function expectFactToExists(fact: [string, string, string]) {
  expect(await queryFactCount(fact)).to.be.greaterThan(0);
}

export async function expectFactToNotExists(fact: [string, string, string]) {
  const count = await queryFactCount(fact);
  if (count !== 0) {
    console.error('expectFactToNotExists but it does:', fact);
  }
  expect(count).to.eq(0);
}

export async function expectNotToBeAbleToWriteAttribute(attributeId, client) {
  const attributeWithAccess = await client.Attribute.createKeyValue({ name: 'anAttributeWithAccess' });
  const serverURL = await attributeWithAccess.getServerURL();
  const clientId = await attributeWithAccess.getClientId();
  const { actorId } = client;

  const update = (lr, sURL, cId, actId, aId) => fetch(`${sURL}attributes/${aId}?clientId=${cId}`, {
    credentials: 'include',
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clientId: cId,
      actorId: actId,
      facts: [],
      change: [{ UPDATED: 'VALUE' }],
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
  expect(unauthorizedContent).to.eql(403);
}

export async function expectNotToBeAbleToReadOrWriteAttribute(attributeId, client) {
  const attributeWithAccess = await client.Attribute.createKeyValue({ name: 'anAttributeWithAccess' });
  const serverURL = await attributeWithAccess.getServerURL();
  const clientId = await attributeWithAccess.getClientId();

  expect((await client.Fact.findAll({
    subject: [attributeId],
  })).length).to.eql(0);

  expect((await client.Fact.findAll({
    object: [attributeId],
  })).length).to.eql(0);

  client.Attribute.clearCache();
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
  expect(unauthorizedContent).to.match(/Forbidden/);

  await expectNotToBeAbleToWriteAttribute(attributeId, client);
}

export async function expectNotToBeAbleToUseAsSubject(attributeId, client) {
  const relations = ['belongsTo', '$isMemberOf', '$isHostOf', '$isAccountableFor', '$isATermFor'];

  for (let index = 0; index < relations.length; index += 1) {
    const attributeWithAccessA = await client.Attribute.createKeyValue({});
    const attributeWithAccessB = await client.Attribute.createKeyValue({});
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
    const attributeWithAccessA = await client.Attribute.createKeyValue({});
    const attributeWithAccessB = await client.Attribute.createKeyValue({});
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
