/* eslint-disable @typescript-eslint/no-unused-expressions */

import { expect } from 'chai';
import { v4 as uuid } from 'uuid';
import { waitFor } from '../helpers';
import LinkedRecords from '../../src/browser_sdk';

function createClient(): LinkedRecords {
  return new LinkedRecords(new URL('http://0.0.0.0:3000'));
}

describe('Long Text Attributes', () => {
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

  describe('attribute.change()', () => {
    it('makes sure the value converges on all clients', async () => {
      const clientA = createClient();
      const clientB = createClient();

      const attributeClientA = await clientA.Attribute.create('longText', '<p>text</p>');

      if (!attributeClientA.id) throw Error('Attribute should have an id. Something went wrong when creating it!');

      const attributeClientB = await clientB.Attribute.find(attributeClientA.id);

      await attributeClientA.get(); // To make sure the attribute state is loaded
      await attributeClientB.get();

      await attributeClientA.set('<p>texta</p>');
      await attributeClientA.set('<p>textab</p>');
      await attributeClientA.set('<p>textabc</p>');

      await attributeClientB.set('<p>text1</p>');
      await attributeClientB.set('<p>text12</p>');
      await attributeClientB.set('<p>text123</p>');

      await waitFor(async () => (await attributeClientA.getValue()).length === 17);

      const convergedValueClientA = await attributeClientA.getValue();
      const convergedValueClientB = await attributeClientB.getValue();

      expect(convergedValueClientA).to.equal(convergedValueClientB);
      expect(convergedValueClientB).to.match(/<p>text[abc123]{6}<\/p>/);
      expect(convergedValueClientA.length).to.equal(17);
    });
  });
});
