/* eslint-disable max-len */

import { expect } from 'chai';
import { createClient, cleanupClients, truncateDB } from '../helpers';

function filterAutoCreatedFacts(facts) {
  return facts.filter((fact) => !['$wasCreatedBy'].includes(fact.predicate));
}

describe('Fact', () => {
  beforeEach(truncateDB);
  afterEach(cleanupClients);

  describe('Facts.create()', () => {
    it('creates facts', async () => {
      const [client] = await createClient();
      const [otherClient] = await createClient();

      const hermanMelville = await client.Attribute.create('keyValue', { name: 'Herman Melville' });
      const mobyDick = await client.Attribute.create('keyValue', { title: 'Moby Dick' });
      const mobyDickSummary = await client.Attribute.create('longText', 'it is about a whale');
      const mobyDickContent = await client.Attribute.create('longText', 'the moby dick story');

      await client.Fact.createAll([
        ['Author', '$isATermFor', 'somebody who writes a book'],
        ['Book', '$isATermFor', 'a book'],
        [hermanMelville.id, 'isA', 'Author'],
        [mobyDick.id, 'isA', 'Book'],
        [hermanMelville.id, 'relatesTo', mobyDick.id],
        [mobyDickContent.id, 'relatesTo', mobyDick.id],
        [mobyDickSummary.id, 'relatesTo', mobyDick.id],
      ]);

      const hermanMelvilleFacts = filterAutoCreatedFacts(await otherClient.Fact.findAll({
        subject: [hermanMelville.id!],
      }));

      const mobyDickFacts = filterAutoCreatedFacts(await otherClient.Fact.findAll({
        subject: [mobyDick.id!],
      }));

      expect(hermanMelvilleFacts.length).to.be.equal(2);
      expect(mobyDickFacts.length).to.be.equal(1);

      if (!mobyDickFacts[0]) throw new Error('make ts happy');

      expect(mobyDickFacts[0].subject).to.be.equal(mobyDick.id);
      expect(mobyDickFacts[0].predicate).to.be.equal('isA');
      expect(mobyDickFacts[0].object).to.be.equal('Book');
    });

    it('does not allow to crate facts with special chars (only $ at the beginning and * at the end of the property name are allowed)');
    it('reports an error if the fact data does not fit into the database because of the text length');

    // describe('"*" predicate suffix');
    // describe('$isATermFor predicate');
    // describe('$wasCreatedBy predicate');
  });

  describe('Facts.findAll()', () => {
    // TODO: test path: throw new Error(`$anything selector is only allowed in context of the following predicates: ${predicatedAllowedToQueryAnyObjects.join(', ')}`);

    it('finds facts by a object transitive isA relationship', async () => {
      const [client] = await createClient();
      const [otherClient] = await createClient();

      const todo = await client.Attribute.create('keyValue', { name: 'To-do', color: '#fff' });
      const openTodo = await client.Attribute.create('keyValue', { name: 'open To-do', color: '#ffa' });
      const importantOpenTodo = await client.Attribute.create('keyValue', { name: 'important open To-do', color: '#ff0' });

      await client.Fact.createAll([
        ['ContentType', '$isATermFor', 'some concept'],
        [todo.id, 'isA*', 'ContentType'],
        [openTodo.id, 'isA*', todo.id],
        [importantOpenTodo.id, 'isA*', openTodo.id],
      ]);

      const todos = filterAutoCreatedFacts(await otherClient.Fact.findAll({
        subject: [['isA*', 'ContentType']],
      }));

      expect(todos.length).to.be.equal(3);
    });

    it('finds no facts if object and subject set is empty', async () => {
      const [client] = await createClient();
      const [otherClient] = await createClient();

      const hermanMelville = await client.Attribute.create('keyValue', { name: 'Herman Melville' });
      const mobyDick = await client.Attribute.create('keyValue', { title: 'Moby Dick' });
      const mobyDickSummary = await client.Attribute.create('longText', 'it is about a whale');
      const mobyDickContent = await client.Attribute.create('longText', 'the moby dick story');

      await client.Fact.createAll([
        ['Author', '$isATermFor', 'some concept'],
        ['Book', '$isATermFor', 'some concept'],
        [hermanMelville.id, 'isA', 'Author'],
        [mobyDick.id, 'isA', 'Book'],
        [hermanMelville.id, 'relatesTo', mobyDick.id],
        [mobyDickContent.id, 'relatesTo', mobyDick.id],
        [mobyDickSummary.id, 'relatesTo', mobyDick.id],
      ]);

      const hermanMelvilleFacts = filterAutoCreatedFacts(await otherClient.Fact.findAll({
        subject: [hermanMelville.id!],
      }));

      const mobyDickFacts = filterAutoCreatedFacts(await otherClient.Fact.findAll({
        subject: [mobyDick.id!],
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
      const [client] = await createClient();
      const [otherClient] = await createClient();

      const hermanMelville = await client.Attribute.create('keyValue', { name: 'Herman Melville' });
      const mobyDick = await client.Attribute.create('keyValue', { title: 'Moby Dick' });
      const mobyDickSummary = await client.Attribute.create('longText', 'it is about a whale');
      const mobyDickContent = await client.Attribute.create('longText', 'the moby dick story');

      await client.Fact.createAll([
        ['AuthorizedUser', '$isATermFor', 'some concept'],
        ['Book', '$isATermFor', 'some concept'],
        ['Author', '$isATermFor', 'some concept'],
        ['ContentType', '$isATermFor', 'some concept'],
        ['User', '$isATermFor', 'some concept'],

        ['AuthorizedUser', 'isNarrowConceptOf', 'User'],
        ['Book', 'isNarrowConceptOf', 'ContentType'],
        ['Author', 'isNarrowConceptOf', 'ContentType'],
        ['Author', 'relatesTo', 'Book'],

        [mobyDick.id, 'isA', 'Book'],
        [hermanMelville.id, 'isA', 'Author'],
        [hermanMelville.id, 'relatesTo', mobyDick.id],
        [mobyDickContent.id, 'relatesTo', mobyDick.id],
        [mobyDickSummary.id, 'relatesTo', mobyDick.id],
      ]);

      await client.Fact.createAll([
        ['Author', 'hasPartnershipWith', 'ThePublisherClub'],
      ]);

      const hermanMelvilleFacts = filterAutoCreatedFacts(await otherClient.Fact.findAll({
        subject: [hermanMelville.id!],
      }));

      const mobyDickFacts = filterAutoCreatedFacts(await otherClient.Fact.findAll({
        subject: [mobyDick.id!],
      }));

      expect(hermanMelvilleFacts.length).to.be.equal(2);
      expect(mobyDickFacts.length).to.be.equal(1);

      if (!mobyDickFacts[0]) throw new Error('make ts happy');

      expect(mobyDickFacts[0].subject).to.be.equal(mobyDick.id);
      expect(mobyDickFacts[0].predicate).to.be.equal('isA');
      expect(mobyDickFacts[0].object).to.be.equal('Book');

      const facts = filterAutoCreatedFacts(await otherClient.Fact.findAll([
        {
          subject: [['isNarrowConceptOf', 'ContentType']],
          object: [['isNarrowConceptOf', 'ContentType']],
        },
        {
          subject: [['isNarrowConceptOf', 'ContentType']],
          object: ['ContentType'],
        },
      ]));

      expect(facts.length).to.be.equal(3);
      expect(facts.filter((fact) => fact.subject === 'Book' && fact.object === 'ContentType')).to.have.lengthOf(1);
      expect(facts.filter((fact) => fact.subject === 'Author' && fact.object === 'ContentType')).to.have.lengthOf(1);
      expect(facts.filter((fact) => fact.subject === 'Author' && fact.object === 'Book')).to.have.lengthOf(1);
      expect(facts.filter((fact) => fact.subject === 'Author' && fact.object === 'ThePublisherClub')).to.have.lengthOf(0);
    });
  });
});
