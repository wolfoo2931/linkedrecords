/* eslint-disable max-len */
import { expect } from 'chai';
import KeyValueAttribute from '../../src/attributes/key_value/client/index';
import {
  createClient, truncateDB, cleanupClients, changeUserContext, sleep,
} from '../helpers';

function filterAutoCreatedFacts(facts) {
  return facts.filter((fact) => !['$wasCreatedBy'].includes(fact.predicate));
}

describe('Auth', () => {
  beforeEach(truncateDB);
  afterEach(cleanupClients);

  it('does not allow to read attributes create by other users', async () => {
    await changeUserContext('testuser-1-id');
    const [client1] = await createClient();

    await changeUserContext('testuser-unauthorized-id');
    const [client2] = await createClient();

    await changeUserContext('testuser-1-id');
    const attribute = await client1.Attribute.create('keyValue', { foo: 'bar' });
    const authorizedReadAttribute = await client1.Attribute.find(attribute.id!);

    await changeUserContext('testuser-unauthorized-id');
    const unauthorizedReadAttribute = await client2.Attribute.find(attribute.id!);

    await changeUserContext('testuser-unauthorized-id');
    expect(await unauthorizedReadAttribute).to.eql(undefined);

    await changeUserContext('testuser-1-id');
    expect(await authorizedReadAttribute!.getValue()).to.eql({ foo: 'bar' });

    await authorizedReadAttribute!.set({ foo: 'authorized' });
    await sleep(2000);

    expect(await authorizedReadAttribute!.getValue()).to.eql({ foo: 'authorized' });

    // FIXME: This test scenario does not work anymore after switching to websockets
    // const authorizedReadAttributeDirtyHack = await client1.Attribute.find(attribute.id!);

    await changeUserContext('testuser-unauthorized-id');
    expect(unauthorizedReadAttribute).to.eql(undefined);

    // await authorizedReadAttributeDirtyHack!.set({ foo: 'unauthorized' });

    await changeUserContext('testuser-1-id');
    // const dirtyHackCheck = await client1.Attribute.find(attribute.id!);
    // expect(await dirtyHackCheck!.getValue()).to.eql({ foo: 'authorized' });

    const authorizedCompound = <{ doc: KeyValueAttribute }> <unknown> await client1.Attribute.findAll({ doc: attribute.id! });

    await changeUserContext('testuser-unauthorized-id');
    const unauthorizedCompound = await client2.Attribute.findAll({ doc: attribute.id! });
    expect(unauthorizedCompound).to.eql({});

    await changeUserContext('testuser-1-id');
    expect(await authorizedCompound.doc.getValue()).to.eql({ foo: 'authorized' });
  });

  it('allows to create user term facts for everybody', async () => {
    await changeUserContext('testuser-1-id');
    const [client1] = await createClient();

    await changeUserContext('testuser-2-id');
    const [client2] = await createClient();

    await changeUserContext('testuser-1-id');
    await client1.Fact.createAll([
      ['Author', '$isATermFor', 'somebody who writes a book'],
      ['Book', '$isATermFor', 'a book'],
    ]);

    await changeUserContext('testuser-2-id');
    await client2.Fact.createAll([
      ['Author', '$isATermFor', 'somebody who writes a book'],
      ['Book', '$isATermFor', 'a book'],
    ]);

    await changeUserContext('testuser-1-id');
    await client1.Attribute.create('keyValue', { name: 'bookC1a' }, [
      ['isA', 'Book'],
    ]);

    await client1.Attribute.create('keyValue', { name: 'bookC1b' }, [
      ['isA', 'Book'],
    ]);

    await changeUserContext('testuser-2-id');
    await client2.Attribute.create('keyValue', { name: 'bookC2' }, [
      ['isA', 'Book'],
    ]);

    await changeUserContext('testuser-1-id');
    const { books1 } = <{ books1: KeyValueAttribute[] }> <unknown> await client1.Attribute.findAll({
      books1: [
        ['$it', 'isA', 'Book'],
      ],
    });

    expect(books1.length).to.equal(2);

    await changeUserContext('testuser-2-id');
    const { books2 } = <{ books2: KeyValueAttribute[] }> <unknown> await client2.Attribute.findAll({
      books2: [
        ['$it', 'isA', 'Book'],
      ],
    });

    expect(books2.length).to.equal(1);
  });

  it('filters attributes in findAll when the query is a string', async () => {
    await changeUserContext('testuser-1-id');
    const [client1] = await createClient();

    await changeUserContext('testuser-2-id');
    const [client2] = await createClient();

    await changeUserContext('testuser-1-id');
    await client1.Fact.createAll([
      ['Author', '$isATermFor', 'somebody who writes a book'],
      ['Book', '$isATermFor', 'a book'],
    ]);

    await changeUserContext('testuser-2-id');
    await client2.Fact.createAll([
      ['Author', '$isATermFor', 'somebody who writes a book'],
      ['Book', '$isATermFor', 'a book'],
    ]);

    await changeUserContext('testuser-1-id');
    const atrBook1 = await client1.Attribute.create('keyValue', { name: 'bookC1a' }, [
      ['isA', 'Book'],
    ]);

    await client1.Attribute.create('keyValue', { name: 'bookC1b' }, [
      ['isA', 'Book'],
    ]);

    await changeUserContext('testuser-2-id');
    await client2.Attribute.create('keyValue', { name: 'bookC2' }, [
      ['isA', 'Book'],
    ]);

    await changeUserContext('testuser-1-id');

    const { book1 } = <{ book1: KeyValueAttribute }> <unknown> await client1.Attribute.findAll({
      book1: atrBook1.id!,
    });

    expect(await book1.getValue()).to.deep.equal({ name: 'bookC1a' });

    await changeUserContext('testuser-2-id');
    const { book1unauth } = <{ book1unauth: KeyValueAttribute }> <unknown> await client2.Attribute.findAll({
      book1unauth: atrBook1.id!,
    });

    expect(book1unauth).to.equal(undefined);
  });

  it('filters unauthorized facts when creating attribute with facts', async () => {
    await changeUserContext('testuser-1-id');
    const [client1] = await createClient();

    await changeUserContext('testuser-2-id');
    const [client2] = await createClient();

    await changeUserContext('testuser-1-id');
    await client1.Fact.createAll([
      ['Book', '$isATermFor', 'a book'],
    ]);

    const bookOfC1 = await client1.Attribute.create('keyValue', { name: 'bookBelongingToClient1' }, [
      ['isA', 'Book'],
    ]);

    await changeUserContext('testuser-2-id');
    await client2.Attribute.create('keyValue', { name: 'bookC1a' }, [
      ['isA', 'Book'],
      ['belongsTo', bookOfC1.id],
    ]);

    await changeUserContext('testuser-1-id');
    const { unauthorizedMatches } = await client1.Attribute.findAll({
      unauthorizedMatches: [
        ['belongsTo', bookOfC1.id!],
      ],
    });

    expect(unauthorizedMatches.length).to.equal(0);
  });

  it('filters attributes in find', async () => {
    await changeUserContext('testuser-1-id');
    const [client1] = await createClient();

    await changeUserContext('testuser-2-id');
    const [client2] = await createClient();

    await changeUserContext('testuser-1-id');
    await client1.Fact.createAll([
      ['Author', '$isATermFor', 'somebody who writes a book'],
      ['Book', '$isATermFor', 'a book'],
    ]);

    await changeUserContext('testuser-2-id');
    await client2.Fact.createAll([
      ['Author', '$isATermFor', 'somebody who writes a book'],
      ['Book', '$isATermFor', 'a book'],
    ]);

    await changeUserContext('testuser-1-id');
    const atrBook1 = await client1.Attribute.create('keyValue', { name: 'bookC1a' }, [
      ['isA', 'Book'],
    ]);

    await client1.Attribute.create('keyValue', { name: 'bookC1b' }, [
      ['isA', 'Book'],
    ]);

    await changeUserContext('testuser-2-id');
    await client2.Attribute.create('keyValue', { name: 'bookC2' }, [
      ['isA', 'Book'],
    ]);

    await changeUserContext('testuser-1-id');

    const book1 = await client1.Attribute.find(atrBook1.id!);

    expect(await book1!.getValue()).to.deep.equal({ name: 'bookC1a' });

    await changeUserContext('testuser-2-id');
    const book1unauth = await client2.Attribute.find(atrBook1.id!);

    expect(book1unauth).to.equal(undefined);
  });

  it('does not allow to use a term as subject if the term was not created by the same user', async () => {
    await changeUserContext('testuser-1-id');
    const [client1] = await createClient();

    await changeUserContext('testuser-2-id');
    const [client2] = await createClient();

    await changeUserContext('testuser-1-id');
    await client1.Fact.createAll([
      ['Author', '$isATermFor', 'somebody who writes a book'],
      ['Book', '$isATermFor', 'a book'],
    ]);

    await changeUserContext('testuser-2-id');
    await client2.Fact.createAll([
      ['Author', 'isA', 'Book'],
    ]);

    await changeUserContext('testuser-1-id');
    let termFacts = await client1.Fact.findAll({
      predicate: ['$isATermFor'],
    });

    let authorFacts = await client1.Fact.findAll({
      subject: [
        ['isA', 'Book'],
      ],
    });

    expect(termFacts.length).to.eql(2);
    expect(authorFacts.length).to.eql(0);

    await client1.Fact.createAll([
      ['Author', 'isA', 'Book'],
    ]);

    termFacts = await client1.Fact.findAll({
      predicate: ['$isATermFor'],
    });

    authorFacts = await client1.Fact.findAll({
      subject: [
        ['isA', 'Book'],
      ],
    });

    expect(filterAutoCreatedFacts(termFacts).length).to.eql(2);
    expect(filterAutoCreatedFacts(authorFacts).length).to.eql(2);
  });

  it('is not allowed to create a term if it exists already', async () => {
    const [client] = await createClient();

    await client.Fact.createAll([
      ['Author', '$isATermFor', 'somebody who writes a book'],
      ['Author', '$isATermFor', 'somebody who writes a book'],
    ]);

    await client.Fact.createAll([
      ['Author', '$isATermFor', 'somebody who writes a book'],
    ]);

    const authorFacts = await client.Fact.findAll({
      predicate: ['$isATermFor'],
    });

    expect(authorFacts.length).to.eql(1);
  });

  it('does not allow to subscribe for foreign attributes changes', async () => {
    let updateMessageReceived;
    let subscriptionResult;

    await changeUserContext('testuser-1-id');
    const [client1] = await createClient();

    await changeUserContext('testuser-2-id');
    const [client2] = await createClient();

    await changeUserContext('testuser-1-id');
    const ofInterest = await client1.Attribute.create('keyValue', { name: 'bookC1a' });
    const ofInterestID = ofInterest.id;
    const ofInterestServerURL = ofInterest.serverURL;
    const ofInterestClientID = ofInterest.clientId;

    await changeUserContext('testuser-2-id');
    const attr = await client2.Attribute.create('keyValue', { name: 'XXXX' });

    if (!ofInterestID) {
      throw new Error('ofInterestID should not be unefined');
    }

    const url = `${ofInterestServerURL}attributes/${ofInterestID}/changes?clientId=${ofInterestClientID}`;

    const prom = new Promise<void>((resolve) => {
      subscriptionResult = attr.clientServerBus.subscribe(url, ofInterestID, (parsedData) => {
        updateMessageReceived = parsedData;
        resolve();
      }).catch((error) => error);
    });

    await changeUserContext('testuser-1-id');
    await ofInterest.set({ foo: 'bar2' });

    await Promise.race([
      new Promise((r) => { setTimeout(r, 2000); }),
      prom,
    ]);

    expect(updateMessageReceived).to.eql(undefined);
    expect((await subscriptionResult).message).to.eql('unauthorized');
  });

  it('is allowed to create facts which refer to the authenticated users', async () => {
    const [client] = await createClient();
    const [otherClient] = await createClient();

    await client.Attribute.create('keyValue', { name: 'some data' }, [
      ['belongsTo', client.actorId],
    ]);

    const { myRecords } = await otherClient.Attribute.findAll({
      myRecords: [
        ['belongsTo', client.actorId],
      ],
    });

    if (!Array.isArray(myRecords)) {
      throw new Error('myRecords is not an array');
    }

    expect(myRecords.length).to.eq(1);
  });

  it('allows to create facts about the authenticated users');
  it('allows to create facts refer to the authenticated users');
});
