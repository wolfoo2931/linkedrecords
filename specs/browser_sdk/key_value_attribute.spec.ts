/* eslint-disable max-len */

import { expect } from 'chai';
import { waitFor } from '../helpers';
import LinkedRecords from '../../src/browser_sdk';
import ServerSideEvents from '../../lib/server-side-events/client';

let clients: LinkedRecords[] = [];

function createClient(): [ LinkedRecords, ServerSideEvents ] {
  const serverSideEvents = new ServerSideEvents();
  const client = new LinkedRecords(new URL('http://0.0.0.0:3000'), serverSideEvents);
  clients.push(client);
  return [client, serverSideEvents];
}

describe('Key Value Attributes', () => {
  afterEach(() => {
    clients.forEach((client) => {
      client.serverSideEvents.unsubscribeAll();
    });

    clients = [];
  });

  describe('attribute.create()', () => {
    it('creates an attriubte which can be retrieved by an other client', async () => {
      const [clientA] = createClient();
      const [clientB] = createClient();

      const attribute = await clientA.Attribute.create('keyValue', { foo: 'bar' });

      expect(attribute.id).to.match(/^kv-.{8}-.{4}-.{4}-.{4}-.{12}$/);

      if (!attribute.id) throw Error('Attribute should have an id. Something went wrong when creating it!');

      const attributeFromDB = await clientB.Attribute.find(attribute.id);
      expect(attributeFromDB.id).to.be.equal(attribute.id);

      const data = await attributeFromDB.get();

      expect(data.value.foo).to.be.equal('bar');
    });
  });

  describe('attribute.set()', () => {
    it('makes sure the value converges on all clients', async () => {
      const [clientA] = createClient();
      const [clientB] = createClient();

      const attributeClientA = await clientA.Attribute.create('keyValue', { foo: 'bar' });

      if (!attributeClientA.id) throw Error('Attribute should have an id. Something went wrong when creating it!');

      const attributeClientB = await clientB.Attribute.find(attributeClientA.id);

      attributeClientA.set({ clientA: 'adda', foo: 'bar' });
      attributeClientB.set({ clientB: 'addb', foo: 'bar', new: 'value' });

      await waitFor(async () => Object.keys((await attributeClientA.getValue())).length === 4);
      await waitFor(async () => Object.keys((await attributeClientB.getValue())).length === 4);

      let convergedValueClientA = await attributeClientA.getValue();
      let convergedValueClientB = await attributeClientB.getValue();

      expect(convergedValueClientA.clientA).to.equal('adda');
      expect(convergedValueClientB.clientA).to.equal('adda');
      expect(convergedValueClientA.clientB).to.equal('addb');
      expect(convergedValueClientB.clientB).to.equal('addb');
      expect(convergedValueClientA.foo).to.equal('bar');
      expect(convergedValueClientB.foo).to.equal('bar');
      expect(convergedValueClientA.new).to.equal('value');
      expect(convergedValueClientB.new).to.equal('value');

      attributeClientB.set({ foo: 'bar', new: 'value' });

      await waitFor(async () => Object.keys((await attributeClientA.getValue())).length === 2);
      await waitFor(async () => Object.keys((await attributeClientB.getValue())).length === 2);

      convergedValueClientA = await attributeClientA.getValue();
      convergedValueClientB = await attributeClientB.getValue();

      expect(convergedValueClientA.clientA).to.equal(undefined);
      expect(convergedValueClientB.clientA).to.equal(undefined);
      expect(convergedValueClientA.clientB).to.equal(undefined);
      expect(convergedValueClientB.clientB).to.equal(undefined);
      expect(convergedValueClientA.foo).to.equal('bar');
      expect(convergedValueClientB.foo).to.equal('bar');
      expect(convergedValueClientA.new).to.equal('value');
      expect(convergedValueClientB.new).to.equal('value');
    });
  });
});