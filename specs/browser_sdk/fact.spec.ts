/* eslint-disable max-len */

import { expect } from 'chai';
import { v4 as uuid } from 'uuid';
import LinkedRecords from '../../src/browser_sdk';
import ServerSideEvents from '../../lib/server-side-events/client';

let clients: LinkedRecords[] = [];

function createClient(): [ LinkedRecords, ServerSideEvents ] {
  const serverSideEvents = new ServerSideEvents();
  const client = new LinkedRecords(new URL('http://localhost:3000'), serverSideEvents);
  client.actorId = uuid();
  clients.push(client);
  return [client, serverSideEvents];
}

function filterAutoCreatedFacts(facts) {
  return facts.filter((fact) => !['wasCreatedBy'].includes(fact.predicate));
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

  describe('Facts.create()', () => {
    it('creates facts', async () => {
      const [client] = createClient();
      const [otherClient] = createClient();

      const hermanMelville = await client.Attribute.create('keyValue', { name: 'Herman Melville' });
      const mobyDick = await client.Attribute.create('keyValue', { title: 'Moby Dick' });
      const mobyDickSummary = await client.Attribute.create('longText', 'it is about a whale');
      const mobyDickContent = await client.Attribute.create('longText', 'the moby dick story');

      await client.Fact.create(hermanMelville.id, 'isA', 'Author');
      await client.Fact.create(mobyDick.id, 'isA', 'Book');
      await client.Fact.create(hermanMelville.id, 'relatesTo', mobyDick.id);
      await client.Fact.create(mobyDickContent.id, 'relatesTo', mobyDick.id);
      await client.Fact.create(mobyDickSummary.id, 'relatesTo', mobyDick.id);

      if (hermanMelville.id == null) {
        throw Error('id is null');
      }

      if (mobyDick.id == null) {
        throw Error('id is null');
      }

      const hermanMelvilleFacts = filterAutoCreatedFacts(await otherClient.Fact.findAll({
        subject: [hermanMelville.id],
      }));

      const mobyDickFacts = filterAutoCreatedFacts(await otherClient.Fact.findAll({
        subject: [mobyDick.id],
      }));

      expect(hermanMelvilleFacts.length).to.be.equal(2);
      expect(mobyDickFacts.length).to.be.equal(1);

      if (!mobyDickFacts[0]) throw new Error('make ts happy');

      expect(mobyDickFacts[0].subject).to.be.equal(mobyDick.id);
      expect(mobyDickFacts[0].predicate).to.be.equal('isA');
      expect(mobyDickFacts[0].object).to.be.equal('Book');
    });
  });

  describe('Facts.findAll()', () => {
    it('finds facts by a object transitive isA relationship', async () => {
      const [client] = createClient();
      const [otherClient] = createClient();

      const todo = await client.Attribute.create('keyValue', { name: 'To-do', color: '#fff' });
      const openTodo = await client.Attribute.create('keyValue', { name: 'open To-do', color: '#ffa' });
      const importantOpenTodo = await client.Attribute.create('keyValue', { name: 'important open To-do', color: '#ff0' });

      await client.Fact.create(todo.id, 'isA', 'ContentType');
      await client.Fact.create(openTodo.id, 'isA', todo.id);
      await client.Fact.create(importantOpenTodo.id, 'isA', openTodo.id);

      const todos = filterAutoCreatedFacts(await otherClient.Fact.findAll({
        subject: [['isA', 'ContentType']],
      }));

      expect(todos.length).to.be.equal(3);
    });

    it('finds no facts if object and subject set is empty', async () => {
      const [client] = createClient();
      const [otherClient] = createClient();

      const hermanMelville = await client.Attribute.create('keyValue', { name: 'Herman Melville' });
      const mobyDick = await client.Attribute.create('keyValue', { title: 'Moby Dick' });
      const mobyDickSummary = await client.Attribute.create('longText', 'it is about a whale');
      const mobyDickContent = await client.Attribute.create('longText', 'the moby dick story');

      await client.Fact.create(hermanMelville.id, 'isA', 'Author');
      await client.Fact.create(mobyDick.id, 'isA', 'Book');
      await client.Fact.create(hermanMelville.id, 'relatesTo', mobyDick.id);
      await client.Fact.create(mobyDickContent.id, 'relatesTo', mobyDick.id);
      await client.Fact.create(mobyDickSummary.id, 'relatesTo', mobyDick.id);

      if (hermanMelville.id == null) {
        throw Error('id is null');
      }

      if (mobyDick.id == null) {
        throw Error('id is null');
      }

      const hermanMelvilleFacts = filterAutoCreatedFacts(await otherClient.Fact.findAll({
        subject: [hermanMelville.id],
      }));

      const mobyDickFacts = filterAutoCreatedFacts(await otherClient.Fact.findAll({
        subject: [mobyDick.id],
      }));

      expect(hermanMelvilleFacts.length).to.be.equal(2);
      expect(mobyDickFacts.length).to.be.equal(1);

      if (!mobyDickFacts[0]) throw new Error('make ts happy');

      expect(mobyDickFacts[0].subject).to.be.equal(mobyDick.id);
      expect(mobyDickFacts[0].predicate).to.be.equal('isA');
      expect(mobyDickFacts[0].object).to.be.equal('Book');

      const facts = filterAutoCreatedFacts(await client.Fact.findAll({
        subject: [
          ['isA', 'ContentType'],
        ],
        predicate: [
          'isA',
          'relatesTo',
        ],
        object: [
          ['isA', 'ContentType'],
        ],
      }));

      expect(facts.length).to.be.equal(0);
    });

    it('finds facts', async () => {
      const [client] = createClient();
      const [otherClient] = createClient();

      const hermanMelville = await client.Attribute.create('keyValue', { name: 'Herman Melville' });
      const mobyDick = await client.Attribute.create('keyValue', { title: 'Moby Dick' });
      const mobyDickSummary = await client.Attribute.create('longText', 'it is about a whale');
      const mobyDickContent = await client.Attribute.create('longText', 'the moby dick story');

      await client.Fact.create('AuthorizedUser', 'isNarrowConceptOf', 'User');
      await client.Fact.create('Book', 'isNarrowConceptOf', 'ContentType');
      await client.Fact.create('Author', 'isNarrowConceptOf', 'ContentType');
      await client.Fact.create('Author', 'relatesTo', 'Book');

      await client.Fact.create(mobyDick.id, 'isA', 'Book');
      await client.Fact.create(hermanMelville.id, 'isA', 'Author');
      await client.Fact.create(hermanMelville.id, 'relatesTo', mobyDick.id);
      await client.Fact.create(mobyDickContent.id, 'relatesTo', mobyDick.id);
      await client.Fact.create(mobyDickSummary.id, 'relatesTo', mobyDick.id);

      if (hermanMelville.id == null) {
        throw Error('id is null');
      }

      if (mobyDick.id == null) {
        throw Error('id is null');
      }

      const hermanMelvilleFacts = filterAutoCreatedFacts(await otherClient.Fact.findAll({
        subject: [hermanMelville.id],
      }));

      const mobyDickFacts = filterAutoCreatedFacts(await otherClient.Fact.findAll({
        subject: [mobyDick.id],
      }));

      expect(hermanMelvilleFacts.length).to.be.equal(2);
      expect(mobyDickFacts.length).to.be.equal(1);

      if (!mobyDickFacts[0]) throw new Error('make ts happy');

      expect(mobyDickFacts[0].subject).to.be.equal(mobyDick.id);
      expect(mobyDickFacts[0].predicate).to.be.equal('isA');
      expect(mobyDickFacts[0].object).to.be.equal('Book');

      const facts = filterAutoCreatedFacts(await otherClient.Fact.findAll({
        subject: [
          ['isNarrowConceptOf', 'ContentType'],
        ],
        object: [
          ['isNarrowConceptOf', 'ContentType'], 'ContentType',
        ],
      }));

      expect(facts.length).to.be.equal(3);
      expect(facts.filter((fact) => fact.subject === 'Book' && fact.object === 'ContentType')).to.have.lengthOf(1);
      expect(facts.filter((fact) => fact.subject === 'Author' && fact.object === 'ContentType')).to.have.lengthOf(1);
      expect(facts.filter((fact) => fact.subject === 'Author' && fact.object === 'Book')).to.have.lengthOf(1);
    });
  });
});
