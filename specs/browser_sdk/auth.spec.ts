/* eslint-disable max-len */
import { expect } from 'chai';
import KeyValueAttribute from '../../src/attributes/key_value/client/index';
import {
  createClient, truncateDB, cleanupClients, changeUserContext, sleep,
} from '../helpers';

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

    const authorizedReadAttributeDirtyHack = await client1.Attribute.find(attribute.id!);

    await changeUserContext('testuser-unauthorized-id');
    expect(unauthorizedReadAttribute).to.eql(undefined);

    await authorizedReadAttributeDirtyHack!.set({ foo: 'unauthorized' });

    await changeUserContext('testuser-1-id');
    const dirtyHackCheck = await client1.Attribute.find(attribute.id!);
    expect(await dirtyHackCheck!.getValue()).to.eql({ foo: 'authorized' });

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

    expect(termFacts.length).to.eql(2);
    expect(authorFacts.length).to.eql(2);
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
});
