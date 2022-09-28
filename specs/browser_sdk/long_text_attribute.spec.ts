/* eslint-disable @typescript-eslint/no-unused-expressions */

import { expect } from 'chai';
import { v4 as uuid } from 'uuid';
import { waitFor } from '../helpers';
import LinkedRecords from '../../src/browser_sdk';
import LongTextChange from '../../src/attributes/long_text/long_text_change';
import LongTextAttribute from '../../src/attributes/long_text/client';

let clients: LinkedRecords[] = [];

function createClient(): LinkedRecords {
  const client = new LinkedRecords(new URL('http://0.0.0.0:3000'));
  clients.push(client);
  return client;
}

async function applyChangesOnAttribute(attribute: LongTextAttribute, changes: LongTextChange[]) {
  changes.forEach(async (change: LongTextChange) => {
    await attribute.change(change);
  });
}

describe('Long Text Attributes', () => {
  afterEach(() => {
    clients.forEach((client) => {
      client.Attribute.serverSideEvents.unsubscribeAll();
    });

    clients = [];
  });

  describe('attribute.create()', () => {
    it('creates an attriubte which can be retrieved by an other client', async () => {
      const clientA = createClient();
      const clientB = createClient();

      const content = `<p>${uuid()}</p>`;
      const attribute = await clientA.Attribute.create('longText', content);

      expect(attribute.id).to.match(/^l-.{8}-.{4}-.{4}-.{4}-.{12}$/);

      if (!attribute.id) throw Error('Attribute should have an id. Something went wrong when creating it!');

      const attributeFromDB = await clientB.Attribute.find(attribute.id);
      expect(attributeFromDB.id).to.be.equal(attribute.id);

      const data = await attributeFromDB.get();
      expect(data.value).to.be.equal(content);
    });
  });

  describe('attribute.set()', () => {
    it('makes sure the value converges on all clients', async () => {
      const clientA = createClient();
      const clientB = createClient();

      const attributeClientA = await clientA.Attribute.create('longText', '<p>text</p>');

      if (!attributeClientA.id) throw Error('Attribute should have an id. Something went wrong when creating it!');

      const attributeClientB = await clientB.Attribute.find(attributeClientA.id);

      await attributeClientA.set('<p>texta</p>');
      await attributeClientA.set('<p>textab</p>');
      await attributeClientA.set('<p>textabc</p>');

      await attributeClientB.set('<p>text1</p>');
      await attributeClientB.set('<p>text12</p>');
      await attributeClientB.set('<p>text123</p>');

      await waitFor(async () => (await attributeClientA.getValue()).length === 17);
      await waitFor(async () => (await attributeClientB.getValue()).length === 17);

      const convergedValueClientA = await attributeClientA.getValue();
      const convergedValueClientB = await attributeClientB.getValue();

      expect(convergedValueClientA).to.equal(convergedValueClientB);
      expect(convergedValueClientB).to.match(/<p>text[abc123]{6}<\/p>/);
      expect(convergedValueClientA.length).to.equal(17);
    });
  });

  describe('attribute.change()', () => {
    it('makes sure the value converges on all clients', async () => {
      const clientA = createClient();
      const clientB = createClient();

      const attributeClientA = await clientA.Attribute.create('longText', '<p>text</p>');

      if (!attributeClientA.id) throw Error('Attribute should have an id. Something went wrong when creating it!');

      const attributeClientB = await clientB.Attribute.find(attributeClientA.id);

      applyChangesOnAttribute(attributeClientA, [
        LongTextChange.fromDiff('<p>text</p>', '<p>texta</p>'),
        LongTextChange.fromDiff('<p>texta</p>', '<p>textab</p>'),
        LongTextChange.fromDiff('<p>textab</p>', '<p>textabc</p>'),
      ]);

      applyChangesOnAttribute(attributeClientB, [
        LongTextChange.fromDiff('<p>text</p>', '<p>text1</p>'),
        LongTextChange.fromDiff('<p>text1</p>', '<p>text12</p>'),
        LongTextChange.fromDiff('<p>text12</p>', '<p>text123</p>'),
      ]);

      await waitFor(async () => (await attributeClientA.getValue()).length === 17);
      await waitFor(async () => (await attributeClientB.getValue()).length === 17);

      const convergedValueClientA = await attributeClientA.getValue();
      const convergedValueClientB = await attributeClientB.getValue();

      expect(convergedValueClientA).to.equal(convergedValueClientB);
      expect(convergedValueClientB).to.match(/<p>text[abc123]{6}<\/p>/);
      expect(convergedValueClientA.length).to.equal(17);
    });

    it('makes sure the value converges on all clients when the changeset is not granular (make sure the serverChange is not a diff but a merge of the acutall changes send from the client)', async () => {
      const clientA = createClient();
      const clientB = createClient();

      const attributeClientA = await clientA.Attribute.create('longText', '<p>initial</p>');

      if (!attributeClientA.id) throw Error('Attribute should have an id. Something went wrong when creating it!');

      const attributeClientB = await clientB.Attribute.find(attributeClientA.id);

      applyChangesOnAttribute(attributeClientA, [
        LongTextChange.fromString('-e+f|<p>initialo</p>|<p>initial</p>'),
      ]);

      applyChangesOnAttribute(attributeClientB, [
        LongTextChange.fromString('-e+f|<p>initiald</p>|<p>initial</p>'),
      ]);

      await waitFor(async () => (await attributeClientA.getValue()).length === 30);
      await waitFor(async () => (await attributeClientB.getValue()).length === 30);

      const convergedValueClientA = await attributeClientA.getValue();
      const convergedValueClientB = await attributeClientB.getValue();

      expect(convergedValueClientA).to.equal(convergedValueClientB);
      expect(convergedValueClientA.length).to.equal(30);
    });

    it('makes sure the value converges on all clients when there are more then one change on the server', async () => {
      const clientA = createClient();
      const clientB = createClient();

      const attributeClientA = await clientA.Attribute.create('longText', '<p>initial</p>');

      if (!attributeClientA.id) throw Error('Attribute should have an id. Something went wrong when creating it!');

      const attributeClientB = await clientB.Attribute.find(attributeClientA.id);

      attributeClientB.pauseReceiving();

      await applyChangesOnAttribute(attributeClientA, [
        LongTextChange.fromDiff('<p>initial</p>', '<p>initiala</p>'),
        LongTextChange.fromDiff('<p>initiala</p>', '<p>initialab</p>'),
      ]);

      await waitFor(async () => attributeClientB.messagesWhilePaused.length === 2);

      await applyChangesOnAttribute(attributeClientB, [
        LongTextChange.fromDiff('<p>initial</p>', '<p>initial1</p>'),
      ]);

      attributeClientB.unpauseReceiving();

      await waitFor(async () => (await attributeClientA.getValue()).length === 17);
      await waitFor(async () => (await attributeClientB.getValue()).length === 17);

      const convergedValueClientA = await attributeClientA.getValue();
      const convergedValueClientB = await attributeClientB.getValue();

      expect(convergedValueClientA).to.equal(convergedValueClientB);
      expect(convergedValueClientA.length).to.equal(17);
    });
  });
});
