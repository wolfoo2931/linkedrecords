/* eslint-disable max-len */

import { expect } from 'chai';
import LinkedRecords from '../../src/browser_sdk';
import ServerSideEvents from '../../lib/server-side-events/client';
import LongTextAttribute from '../../src/attributes/long_text/client/index';
import KeyValueAttribute from '../../src/attributes/key_value/client/index';

let clients: LinkedRecords[] = [];

function createClient(): [LinkedRecords, ServerSideEvents] {
  const serverSideEvents = new ServerSideEvents();
  const client = new LinkedRecords(
    new URL('http://localhost:3000'),
    serverSideEvents,
  );
  clients.push(client);
  return [client, serverSideEvents];
}

describe('Fact', () => {
  beforeEach(async () => {
    const [client] = createClient();
    await client.Fact.deleteAll();

    clients.push(client);
  });

  afterEach(() => {
    clients.forEach((client) => {
      client.serverSideEvents.unsubscribeAll();
    });

    clients = [];
  });

  describe('Attribute.findAll()', () => {
    it('find attributes by facts', async () => {
      const [client] = createClient();
      const [otherClient] = createClient();

      const content = await client.Attribute.create('longText', 'the init value');
      const references = await client.Attribute.create('keyValue', { foo: 'bar' });
      const referenceSources1 = await client.Attribute.create('keyValue', { user: 'usr-ab' });
      const referenceSources2 = await client.Attribute.create('keyValue', { user: 'usr-xx' });
      const referenceSources3 = await client.Attribute.create('keyValue', { user: 'usr-cd' });

      await client.Fact.create(references.id, 'belongsTo', content.id);
      await client.Fact.create(references.id, 'isA', 'referenceStore');

      await client.Fact.create(referenceSources1.id, 'isA', 'referenceSourceStore');
      await client.Fact.create(referenceSources2.id, 'isA', 'referenceSourceStore');
      await client.Fact.create(referenceSources3.id, 'isA', 'referenceSourceStore');

      await client.Fact.create(referenceSources1.id, 'belongsTo', content.id);
      await client.Fact.create(referenceSources2.id, 'belongsTo', content.id);
      await client.Fact.create(referenceSources3.id, 'belongsTo', content.id);

      await client.Fact.create(referenceSources1.id, 'belongsTo', 'usr-ab');
      await client.Fact.create(referenceSources2.id, 'belongsTo', 'usr-xx');
      await client.Fact.create(referenceSources3.id, 'belongsTo', 'usr-cd');

      if (content.id == null) {
        throw Error('id is null');
      }

      const { content: contentAttribute, refernces: [referencesAttribute], referenceSources: [referenceSourcesAttribute] } = <{
        content: LongTextAttribute,
        refernces: KeyValueAttribute[],
        referenceSources: KeyValueAttribute[]
      }> <unknown> await otherClient.Attribute.findAll({
        content: content.id,
        refernces: [
          ['belongsTo', content.id],
          ['isA', 'referenceStore'],
        ],
        referenceSources: [
          ['belongsTo', content.id],
          ['isA', 'referenceSourceStore'],
          ['belongsTo', 'usr-xx'],
        ],
      });

      if (!referencesAttribute) {
        throw Error('referencesAttribute is null');
      }

      if (!referenceSourcesAttribute) {
        throw Error('referenceSourcesAttribute is null');
      }

      expect(await contentAttribute.getValue()).to.equal('the init value');
      expect(await referencesAttribute.getValue()).to.deep.equal({ foo: 'bar' });
      expect(await referenceSourcesAttribute.getValue()).to.deep.equal({ user: 'usr-xx' });
    });

    it('returns an empty array when the attribute does not exists', async () => {
      const [client] = createClient();

      const { content: contentAttribute, refernces } = <{
        content: LongTextAttribute,
        refernces: KeyValueAttribute[],
      }> <unknown> await client.Attribute.findAll({
        content: 'not exsting',
        refernces: [
          ['isA', 'notExsting'],
        ],
      });

      expect(contentAttribute).to.equal(null);
      expect(refernces.length).to.equal(0);
    });
  });
});