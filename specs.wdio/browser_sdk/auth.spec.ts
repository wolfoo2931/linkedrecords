/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable arrow-body-style */
/* eslint-disable no-return-assign */
/* eslint-disable max-len */
/* eslint-disable no-await-in-loop */
import { expect } from 'chai';
import Session from '../helpers/session';

async function filterAutoCreatedFacts(facts) {
  const result: any[] = [];

  for (let i = 0; i < facts.length; i += 1) {
    const factAsJson = await facts[i].toJSON();

    if (!['$wasCreatedBy'].includes(factAsJson.predicate)) {
      result.push(facts[i]);
    }
  }

  return result;
}

describe('authorization', () => {
  beforeEach(Session.truncateDB);

  it('does not allow to read attributes create by other users', async () => {
    const [client1, client2] = await Session.getTwoSessions();

    const attribute = await client1.Attribute.create('keyValue', { foo: 'bar' });
    const authorizedReadAttribute = await client1.Attribute.find(await attribute.getId());

    const unauthorizedReadAttribute = await client2.Attribute.find(await attribute.getId());

    expect(await unauthorizedReadAttribute).to.eql(null);

    expect(await authorizedReadAttribute!.getValue()).to.eql({ foo: 'bar' });

    await authorizedReadAttribute!.set({ foo: 'authorized' });

    expect(await authorizedReadAttribute!.getValue()).to.eql({ foo: 'authorized' });

    expect(unauthorizedReadAttribute).to.eql(null);

    const authorizedCompound = await client1.Attribute.findAll({ doc: await attribute.getId() });

    const unauthorizedCompound = await client2.Attribute.findAll({
      doc: await attribute.getId(),
    });

    expect(unauthorizedCompound).to.eql({});

    expect(await authorizedCompound.doc.getValue()).to.eql({ foo: 'authorized' });

    client1.browser.deleteSession();
    client2.browser.deleteSession();
  });

  it('allows to create user term facts for everybody', async () => {
    const [client1, client2] = await Session.getTwoSessions();

    await client1.Fact.createAll([
      ['Author', '$isATermFor', 'somebody who writes a book'],
      ['Book', '$isATermFor', 'a book'],
    ]);

    await client2.Fact.createAll([
      ['Author', '$isATermFor', 'somebody who writes a book'],
      ['Book', '$isATermFor', 'a book'],
    ]);

    await client1.Attribute.create('keyValue', { name: 'bookC1a' }, [
      ['isA', 'Book'],
    ]);

    await client1.Attribute.create('keyValue', { name: 'bookC1b' }, [
      ['isA', 'Book'],
    ]);

    await client2.Attribute.create('keyValue', { name: 'bookC2' }, [
      ['isA', 'Book'],
    ]);

    const { books1 } = await client1.Attribute.findAll({
      books1: [
        ['$it', 'isA', 'Book'],
      ],
    });

    expect(books1.length).to.equal(2);

    const { books2 } = await client2.Attribute.findAll({
      books2: [
        ['$it', 'isA', 'Book'],
      ],
    });

    expect(books2.length).to.equal(1);

    client1.browser.deleteSession();
    client2.browser.deleteSession();
  });

  it('filters attributes in findAll when the query is a string', async () => {
    const [client1, client2] = await Session.getTwoSessions();

    await client1.Fact.createAll([
      ['Author', '$isATermFor', 'somebody who writes a book'],
      ['Book', '$isATermFor', 'a book'],
    ]);

    await client2.Fact.createAll([
      ['Author', '$isATermFor', 'somebody who writes a book'],
      ['Book', '$isATermFor', 'a book'],
    ]);

    const atrBook1 = await client1.Attribute.create('keyValue', { name: 'bookC1a' }, [
      ['isA', 'Book'],
    ]);

    await client1.Attribute.create('keyValue', { name: 'bookC1b' }, [
      ['isA', 'Book'],
    ]);

    await client2.Attribute.create('keyValue', { name: 'bookC2' }, [
      ['isA', 'Book'],
    ]);

    const { book1 } = await client1.Attribute.findAll({
      book1: await atrBook1.getId(),
    });

    expect(await book1.getValue()).to.deep.equal({ name: 'bookC1a' });

    const { book1unauth } = await client2.Attribute.findAll({
      book1unauth: await atrBook1.getId(),
    });

    expect(book1unauth).to.equal(undefined);

    client1.browser.deleteSession();
    client2.browser.deleteSession();
  });

  it('filters unauthorized facts when creating attribute with facts', async () => {
    const [client1, client2] = await Session.getTwoSessions();

    await client1.Fact.createAll([
      ['Book', '$isATermFor', 'a book'],
    ]);

    const bookOfC1 = await client1.Attribute.create('keyValue', { name: 'bookBelongingToClient1' }, [
      ['isA', 'Book'],
    ]);

    await client2.Attribute.create('keyValue', { name: 'bookC1a' }, [
      ['isA', 'Book'],
      ['belongsTo', await bookOfC1.getId()],
    ]);

    const { unauthorizedMatches } = await client1.Attribute.findAll({
      unauthorizedMatches: [
        ['belongsTo', await bookOfC1.getId()],
      ],
    });

    expect(unauthorizedMatches.length).to.equal(0);

    client1.browser.deleteSession();
    client2.browser.deleteSession();
  });

  it('filters attributes in find', async () => {
    const [client1, client2] = await Session.getTwoSessions();

    await client1.Fact.createAll([
      ['Author', '$isATermFor', 'somebody who writes a book'],
      ['Book', '$isATermFor', 'a book'],
    ]);

    await client2.Fact.createAll([
      ['Author', '$isATermFor', 'somebody who writes a book'],
      ['Book', '$isATermFor', 'a book'],
    ]);

    const atrBook1 = await client1.Attribute.create('keyValue', { name: 'bookC1a' }, [
      ['isA', 'Book'],
    ]);

    await client1.Attribute.create('keyValue', { name: 'bookC1b' }, [
      ['isA', 'Book'],
    ]);

    await client2.Attribute.create('keyValue', { name: 'bookC2' }, [
      ['isA', 'Book'],
    ]);

    const book1 = await client1.Attribute.find(await atrBook1.getId());

    expect(await book1!.getValue()).to.deep.equal({ name: 'bookC1a' });

    const book1unauth = await client2.Attribute.find(await atrBook1.getId());

    expect(book1unauth).to.equal(null);

    client1.browser.deleteSession();
    client2.browser.deleteSession();
  });

  it('does not allow to use a term as subject if the term was not created by the same user', async () => {
    const [client1, client2] = await Session.getTwoSessions();

    await client1.Fact.createAll([
      ['Author', '$isATermFor', 'somebody who writes a book'],
      ['Book', '$isATermFor', 'a book'],
    ]);

    await client2.Fact.createAll([
      ['Author', 'isA', 'Book'],
    ]);

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

    expect((await filterAutoCreatedFacts(termFacts)).length).to.eql(2);
    expect((await filterAutoCreatedFacts(authorFacts)).length).to.eql(2);

    client1.browser.deleteSession();
    client2.browser.deleteSession();
  });

  it('is not allowed to create a term if it exists already', async () => {
    const client = await Session.getOneSession();

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

    client.browser.deleteSession();
  });

  it('does not allow to subscribe for foreign attributes changes', async () => {
    const [client1, client2] = await Session.getTwoSessions();

    const ofInterest = await client1.Attribute.create('keyValue', { name: 'bookC1a' });
    const ofInterestID = await ofInterest.getId();
    const ofInterestServerURL = await ofInterest.getServerURL();
    const ofInterestClientID = await ofInterest.getClientId();
    const attr = await client2.Attribute.create('keyValue', { name: 'XXXX' });
    const url = `${ofInterestServerURL}attributes/${ofInterestID}/changes?clientId=${ofInterestClientID}`;

    client2.do((lr, remoteIdOfMyAttr, _ofInterestID, _url) => new Promise<void>((resolve) => {
      const lattr = (window as any).remoteInstances[remoteIdOfMyAttr];

      (window as any).lattr = lattr;
      (window as any).remoteIdOfMyAttr = remoteIdOfMyAttr;

      setTimeout(resolve, 2000);

      (window as any).subscriptionResult = lattr.clientServerBus.subscribe(_url, _ofInterestID, (parsedData) => {
        (window as any).updateMessageReceived = parsedData;
        resolve();
      }).catch((error) => {
        (window as any).subscriptionResultError = error;
      });
    }), attr['proxy-instance'], ofInterestID, url);

    await ofInterest.set({ foo: 'bar2' });

    const updateMessageReceived = await client2.do(() => (window as any).updateMessageReceived);
    const subscriptionResultError = await client2.do(() => (window as any).subscriptionResultError?.message);

    expect(updateMessageReceived).to.eql(null);
    expect(subscriptionResultError).to.eql('unauthorized');

    client1.browser.deleteSession();
    client2.browser.deleteSession();
  });

  it('is allowed to create facts which refer to the authenticated users', async () => {
    const [client, otherClient] = await Session.getTwoSessions();

    await client.Attribute.create('keyValue', { name: 'some data' }, [
      ['belongsTo', await client.getActorId()],
    ]);

    const { myRecords } = await client.Attribute.findAll({
      myRecords: [
        ['belongsTo', await client.getActorId()],
      ],
    });

    const { sombodyElsesRecords } = await otherClient.Attribute.findAll({
      sombodyElsesRecords: [
        ['belongsTo', await client.getActorId()],
      ],
    });

    expect(myRecords.length).to.eq(1);
    expect(sombodyElsesRecords.length).to.eq(0);

    client.browser.deleteSession();
    otherClient.browser.deleteSession();
  });

  it('does only allow to delete term definition facts by the user who crated it', async () => {
    const [client, otherClient] = await Session.getTwoSessions();

    await client.Fact.createAll([
      ['Author', '$isATermFor', 'somebody who writes a book'],
      ['Book', '$isATermFor', '... you know what it is'],
    ]);

    const termFacts = await client.Fact.findAll({
      predicate: ['$isATermFor'],
    });

    expect(termFacts.length).to.eql(2);

    await otherClient.Fact.deleteAll([
      ['Author', '$isATermFor', 'somebody who writes a book'],
    ]);

    const termFacts2 = await client.Fact.findAll({
      predicate: ['$isATermFor'],
    });

    expect(termFacts2.length).to.eql(2);

    client.Fact.deleteAll([
      ['Author', '$isATermFor', 'somebody who writes a book'],
    ]);

    const termFacts3 = await client.Fact.findAll({
      predicate: ['$isATermFor'],
    });

    expect(termFacts3.length).to.eql(1);
  });

  it('allows to invite a user to a group', async () => {
    const [aquaman, nemo, manni] = await Session.getThreeSessions();

    const getTrident = async (c) => {
      const { tridents } = await c.Attribute.findAll({
        tridents: [
          ['$it', '$hasDataType', 'KeyValueAttribute'],
          ['isA', 'Trident'],
        ],
      });

      return tridents;
    };

    await aquaman.Fact.createAll([
      ['Team', '$isATermFor', '...'],
      ['Trident', '$isATermFor', '...'],
      ['Tree', '$isATermFor', '...'],
    ]);

    const fishTeam = await aquaman.Attribute.createKeyValue({ name: 'fish' }, [['isA', 'Team']]);
    const mammalTeam = await aquaman.Attribute.createKeyValue({ name: 'mammal' }, [['isA', 'Team']]);

    await aquaman.Attribute.createKeyValue({ name: 'Trident of Atlan' }, [
      ['isA', 'Trident'],
      ['$isMemberOf', fishTeam.id],
    ]);

    await aquaman.Attribute.createKeyValue({ name: ' Eywa' }, [
      ['isA', 'Tree'],
      ['$isMemberOf', mammalTeam.id],
    ]);

    const aquamansTridents = await getTrident(aquaman);
    const nemosTridents = await getTrident(nemo);
    const mannisTridents = await getTrident(manni);

    expect(aquamansTridents.length).to.eq(1);
    expect(nemosTridents.length).to.eq(0);
    expect(mannisTridents.length).to.eq(0);

    // Make sure nemo cannot invite himself into the fish team,
    // it needs to be done by aquaman.
    await nemo.Fact.createAll([
      [await nemo.getActorId(), '$isMemberOf', fishTeam.id],
    ]);

    const nemosTridentsQ2 = await getTrident(nemo);
    const mannisTridentsQ2 = await getTrident(manni);

    expect(nemosTridentsQ2.length).to.eq(0);
    expect(mannisTridentsQ2.length).to.eq(0);

    // Aquaman invites nemo
    const nemoId = await aquaman.getUserIdByEmail(nemo.email);
    expect(nemoId).eql(await nemo.getActorId());

    await aquaman.Fact.createAll([
      [nemoId, '$isMemberOf', fishTeam.id],
    ]);

    const nemosTridentsQ3 = await getTrident(nemo);
    const mannisTridentsQ3 = await getTrident(manni);

    expect(nemosTridentsQ3.length).to.eq(1);
    expect(mannisTridentsQ3.length).to.eq(0);

    // Make sure nemo cannot invite manni into mammal team because
    // he is neither the creator nor a host of the group
    const manniId = await aquaman.getUserIdByEmail(manni.email);
    expect(manniId).eql(await manni.getActorId());

    await nemo.Fact.createAll([[manniId, '$isMemberOf', fishTeam.id]]);

    const nemosTridentsQ4 = await getTrident(nemo);
    const mannisTridentsQ4 = await getTrident(manni);

    expect(nemosTridentsQ4.length).to.eq(1);
    expect(mannisTridentsQ4.length).to.eq(0);
  });

  it('allows a creator of a group do delegate host access to other members so they can invite people too');
  it('allows to revoke membership of a user');

  it('allows to create facts about the authenticated users');
  it('allows to create facts refer to the authenticated users');
  it('is not possible to use a custom predicate which starts with "$"');
  it('is not be possible to find out which groups a user is member in');
});
