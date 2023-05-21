/* eslint-disable max-len */

import { expect } from 'chai';
import { KeyValueChange } from '../../src/browser_sdk';
import {
  createClient, cleanupClients, truncateDB, waitFor,
} from '../helpers';

describe('Key Value Attributes', () => {
  beforeEach(truncateDB);
  afterEach(cleanupClients);

  describe('attribute.create()', () => {
    it('creates an attriubte which can be retrieved by an other client', async () => {
      const [clientA] = await createClient();
      const [clientB] = await createClient();

      const attribute = await clientA.Attribute.create('keyValue', { foo: 'bar' });

      expect(attribute.id).to.match(/^kv-.{8}-.{4}-.{4}-.{4}-.{12}$/);

      if (!attribute.id) throw Error('Attribute should have an id. Something went wrong when creating it!');

      const attributeFromDB = await clientB.Attribute.find(attribute.id);
      expect(attributeFromDB!.id).to.be.equal(attribute.id);

      const data = await attributeFromDB!.get();

      expect(data!.value.foo).to.be.equal('bar');
    });
  });

  describe('attribute.set()', () => {
    it('makes sure the value converges on all clients', async () => {
      const [clientA] = await createClient();
      const [clientB] = await createClient();

      const attributeClientA = await clientA.Attribute.create('keyValue', { foo: 'bar' });

      if (!attributeClientA.id) throw Error('Attribute should have an id. Something went wrong when creating it!');

      const attributeClientB = await clientB.Attribute.find(attributeClientA.id);

      attributeClientA.set({ clientA: 'adda', foo: 'bar' });
      attributeClientB!.set({ clientB: 'addb', foo: 'bar', new: 'value' });

      await waitFor(async () => Object.keys((await attributeClientA.getValue())).length === 4);
      await waitFor(async () => Object.keys((await attributeClientB!.getValue())).length === 4);

      let convergedValueClientA = await attributeClientA.getValue();
      let convergedValueClientB = await attributeClientB!.getValue();

      expect(convergedValueClientA.clientA).to.equal('adda');
      expect(convergedValueClientB.clientA).to.equal('adda');
      expect(convergedValueClientA.clientB).to.equal('addb');
      expect(convergedValueClientB.clientB).to.equal('addb');
      expect(convergedValueClientA.foo).to.equal('bar');
      expect(convergedValueClientB.foo).to.equal('bar');
      expect(convergedValueClientA.new).to.equal('value');
      expect(convergedValueClientB.new).to.equal('value');

      attributeClientB!.set({ foo: 'bar', new: 'value' });

      await waitFor(async () => Object.keys((await attributeClientA.getValue())).length === 2);
      await waitFor(async () => Object.keys((await attributeClientB!.getValue())).length === 2);

      convergedValueClientA = await attributeClientA.getValue();
      convergedValueClientB = await attributeClientB!.getValue();

      expect(convergedValueClientA.clientA).to.equal(undefined);
      expect(convergedValueClientB.clientA).to.equal(undefined);
      expect(convergedValueClientA.clientB).to.equal(undefined);
      expect(convergedValueClientB.clientB).to.equal(undefined);
      expect(convergedValueClientA.foo).to.equal('bar');
      expect(convergedValueClientB.foo).to.equal('bar');
      expect(convergedValueClientA.new).to.equal('value');
      expect(convergedValueClientB.new).to.equal('value');
    });

    it('propagetes all changes to all attribute instances', async () => {
      const [clientA] = await createClient();
      const [clientB] = await createClient();

      const attributeClientA = await clientA.Attribute.create('keyValue', { foo: 'bar' });
      const attributeClientB = await clientB.Attribute.find(attributeClientA.id!);

      await attributeClientA.set({
        foo: 'bar',
        foo2: {
          deep: {
            nested: {
              value: 'dn',
            },
          },
        },
      });

      await waitFor(async () => Object.keys((await attributeClientB!.getValue())).length === 2);

      expect(await attributeClientB!.getValue()).to.eqls({
        foo: 'bar',
        foo2: {
          deep: {
            nested: {
              value: 'dn',
            },
          },
        },
      });
    });
  });

  describe('attribute.change()', () => {
    it('allows to change only parts of the document when the value is a JSON object', async () => {
      const [clientA] = await createClient();
      const [clientB] = await createClient();

      const attributeClientA = await clientA.Attribute.create('keyValue', { foo: 'bar' });

      await attributeClientA.change(new KeyValueChange([
        { key: 'foo2', value: { nested: 'values', more: undefined } },
      ]));

      const reloadedAttribute = await clientB.Attribute.find(attributeClientA.id!);

      await waitFor(async () => Object.keys((await reloadedAttribute!.getValue())).length === 2);

      expect(await reloadedAttribute!.getValue()).to.eqls({
        foo: 'bar',
        foo2: { nested: 'values' },
      });
    });

    it('propagetes all changes to all attribute instances', async () => {
      const [clientA] = await createClient();
      const [clientB] = await createClient();

      const attributeClientA = await clientA.Attribute.create('keyValue', { foo: 'bar' });
      const attributeClientB = await clientB.Attribute.find(attributeClientA.id!);

      await attributeClientA.change(new KeyValueChange([
        { key: 'foo2', value: { deep: { nested: { value: 'dn' } }, more: undefined } },
      ]));

      await waitFor(async () => Object.keys((await attributeClientB!.getValue())).length === 2);

      expect(await attributeClientB!.getValue()).to.eqls({
        foo: 'bar',
        foo2: {
          deep: {
            nested: {
              value: 'dn',
            },
          },
        },
      });
    });
  });
});
