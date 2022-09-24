/* eslint-disable @typescript-eslint/no-unused-expressions */

import { expect } from 'chai';
import { v4 as uuid } from 'uuid';
import LinkedRecords from '../../src/browser_sdk';

const linkedRecords = new LinkedRecords(new URL('http://0.0.0.0:3000'));

describe('Long Text Attributes', () => {
  describe('attribute.create()', () => {
    it('creates an attriubte which can be retrieved by an other client', async () => {
      const content = `<p>${uuid()}</p>`;
      const attribute = await linkedRecords.Attribute.create('longText', content);

      expect(attribute.id).to.match(/^l-.{8}-.{4}-.{4}-.{4}-.{12}$/);

      if (!attribute.id) {
        throw Error('Attribute should have an id');
      }

      const attributeFromDB = await linkedRecords.Attribute.find(attribute.id);
      expect(attributeFromDB.id).to.be.equal(attribute.id);

      const data = await attributeFromDB.get();
      expect(data.value).to.be.equal(content);
    });
  });
});
