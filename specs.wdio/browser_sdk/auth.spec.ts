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

    if (!['$isAccountableFor'].includes(factAsJson.predicate)) {
      result.push(facts[i]);
    }
  }

  return result;
}

const getTridents = async (c, type = 'Trident') => {
  const { tridents } = await c.Attribute.findAll({
    tridents: [
      ['$it', '$hasDataType', 'KeyValueAttribute'],
      ['isA', type],
    ],
  });

  return tridents;
};

const getTeams = async (c) => {
  const { teams } = await c.Attribute.findAll({
    teams: [
      ['$it', '$hasDataType', 'KeyValueAttribute'],
      ['isA', 'Team'],
    ],
  });

  return teams;
};

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

  it('allows anybody to create term facts', async () => {
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

    const { somebodyElsesRecords } = await otherClient.Attribute.findAll({
      somebodyElsesRecords: [
        ['belongsTo', await client.getActorId()],
      ],
    });

    expect(myRecords.length).to.eq(1);
    expect(somebodyElsesRecords.length).to.eq(0);

    client.browser.deleteSession();
    otherClient.browser.deleteSession();
  });

  it('does only allow to delete term definition facts by the user who created it', async () => {
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

    const aquamansTridents = await getTridents(aquaman);
    const nemosTridents = await getTridents(nemo);
    const mannisTridents = await getTridents(manni);

    expect(aquamansTridents.length).to.eq(1);
    expect(nemosTridents.length).to.eq(0);
    expect(mannisTridents.length).to.eq(0);

    // Make sure nemo cannot invite himself into the fish team,
    // it needs to be done by aquaman.
    await nemo.Fact.createAll([
      [await nemo.getActorId(), '$isMemberOf', fishTeam.id],
    ]);

    const nemosTridentsQ2 = await getTridents(nemo);
    const mannisTridentsQ2 = await getTridents(manni);

    expect(nemosTridentsQ2.length).to.eq(0);
    expect(mannisTridentsQ2.length).to.eq(0);

    // Aquaman invites nemo
    const nemoId = await aquaman.getUserIdByEmail(nemo.email);
    expect(nemoId).eql(await nemo.getActorId());

    await aquaman.Fact.createAll([
      [nemoId, '$isMemberOf', fishTeam.id],
    ]);

    const nemosTridentsQ3 = await getTridents(nemo);
    const mannisTridentsQ3 = await getTridents(manni);

    expect(nemosTridentsQ3.length).to.eq(1);
    expect(mannisTridentsQ3.length).to.eq(0);

    // Make sure nemo cannot invite manni into fish team because
    // he is neither the creator nor a host of the group
    const manniId = await aquaman.getUserIdByEmail(manni.email);
    expect(manniId).eql(await manni.getActorId());
    await nemo.Fact.createAll([[manniId, '$isMemberOf', fishTeam.id]]);

    const nemosTridentsQ4 = await getTridents(nemo);
    const mannisTridentsQ4 = await getTridents(manni);

    expect(nemosTridentsQ4.length).to.eq(1);
    expect(mannisTridentsQ4.length).to.eq(0);
  });

  it('allows a creator of a group do delegate host access to other members so they can invite people too', async () => {
    const [aquaman, nemo, manni] = await Session.getThreeSessions();

    await aquaman.Fact.createAll([
      ['Team', '$isATermFor', '...'],
      ['Trident', '$isATermFor', '...'],
    ]);

    const fishTeam = await aquaman.Attribute.createKeyValue({ name: 'fish' }, [['isA', 'Team']]);

    await aquaman.Attribute.createKeyValue({ name: 'Trident of Atlan' }, [
      ['isA', 'Trident'],
      ['$isMemberOf', fishTeam.id],
    ]);

    // Aquaman invites nemo (makes him host)
    const nemoId = await aquaman.getUserIdByEmail(nemo.email);
    await aquaman.Fact.createAll([[nemoId, '$isHostOf', fishTeam.id]]);

    // No nemo can invite somebody else
    const manniId = await nemo.getUserIdByEmail(manni.email);
    await nemo.Fact.createAll([[manniId, '$isMemberOf', fishTeam.id]]);

    const nemosTridentsQ4 = await getTridents(nemo);
    const mannisTridentsQ4 = await getTridents(manni);
    const aquamanTridentsQ4 = await getTridents(aquaman);

    expect(nemosTridentsQ4.length).to.eq(1);
    expect(mannisTridentsQ4.length).to.eq(1);
    expect(aquamanTridentsQ4.length).to.eq(1);
  });

  it('does not allow to invite other user into a group if the inviter not associated with the group', async () => {
    const [aquaman, nemo, manni] = await Session.getThreeSessions();

    await aquaman.Fact.createAll([
      ['Team', '$isATermFor', '...'],
      ['Trident', '$isATermFor', '...'],
    ]);

    const fishTeam = await aquaman.Attribute.createKeyValue({ name: 'fish' }, [['isA', 'Team']]);

    await aquaman.Attribute.createKeyValue({ name: 'Trident of Atlan' }, [
      ['isA', 'Trident'],
      ['$isMemberOf', fishTeam.id],
    ]);

    // Nemo should not be allowed to invite manni as nemo is not part of the fish team
    const manniId = await nemo.getUserIdByEmail(manni.email);
    expect(manniId).eql(await manni.getActorId());
    await nemo.Fact.createAll([[manniId, '$isMemberOf', fishTeam.id]]);

    const mannisTridentsQ4 = await getTridents(manni);

    expect(mannisTridentsQ4.length).to.eq(0);
  });

  it('does not allow to invite other user into a group if the inviter is a member (he need to be host or accountable)', async () => {
    const [aquaman, nemo, manni] = await Session.getThreeSessions();

    await aquaman.Fact.createAll([
      ['Team', '$isATermFor', '...'],
      ['Trident', '$isATermFor', '...'],
    ]);

    const fishTeam = await aquaman.Attribute.createKeyValue({ name: 'fish' }, [['isA', 'Team']]);

    await aquaman.Attribute.createKeyValue({ name: 'Trident of Atlan' }, [
      ['isA', 'Trident'],
      ['$isMemberOf', fishTeam.id],
    ]);

    // Aquaman invites nemo
    const nemoId = await aquaman.getUserIdByEmail(nemo.email);
    await aquaman.Fact.createAll([[nemoId, '$isMemberOf', fishTeam.id]]);

    // Nemo should not be allowed to invite manni as nemo does not has host permission
    const manniId = await nemo.getUserIdByEmail(manni.email);
    expect(manniId).eql(await manni.getActorId());
    await nemo.Fact.createAll([[manniId, '$isMemberOf', fishTeam.id]]);

    const mannisTridentsQ4 = await getTridents(manni);

    expect(mannisTridentsQ4.length).to.eq(0);
  });

  it('allows to revoke membership of a user', async () => {
    const [aquaman, nemo, manni] = await Session.getThreeSessions();

    await aquaman.Fact.createAll([
      ['Team', '$isATermFor', '...'],
      ['Trident', '$isATermFor', '...'],
    ]);

    const fishTeam = await aquaman.Attribute.createKeyValue({ name: 'fish' }, [['isA', 'Team']]);

    const trident = await aquaman.Attribute.createKeyValue({ name: 'Trident of Atlan' }, [
      ['isA', 'Trident'],
      ['$isMemberOf', fishTeam.id],
    ]);

    // Aquaman invites nemo (makes him host)
    const nemoId = await aquaman.getUserIdByEmail(nemo.email);
    await aquaman.Fact.createAll([[nemoId, '$isHostOf', fishTeam.id]]);

    const nemosTridentsQ4 = await getTridents(nemo);
    const mannisTridentsQ4 = await getTridents(manni);
    const aquamanTridentsQ4 = await getTridents(aquaman);

    expect(nemosTridentsQ4.length).to.eq(1);
    expect(aquamanTridentsQ4.length).to.eq(1);
    expect(mannisTridentsQ4.length).to.eq(0);

    // No nemo can invite somebody else
    const manniId = await nemo.getUserIdByEmail(manni.email);
    await nemo.Fact.createAll([[manniId, '$isMemberOf', fishTeam.id]]);

    const nemosTridentsQ5 = await getTridents(nemo);
    const mannisTridentsQ5 = await getTridents(manni);
    const aquamanTridentsQ5 = await getTridents(aquaman);

    expect(nemosTridentsQ5.length).to.eq(1);
    expect(mannisTridentsQ5.length).to.eq(1);
    expect(aquamanTridentsQ5.length).to.eq(1);

    // Manni cannot invoke Nemos membership as Manni is not a host
    await manni.Fact.deleteAll([[manniId, '$isMemberOf', fishTeam.id!]]);

    const nemosTridentsQ6 = await getTridents(nemo);
    const mannisTridentsQ6 = await getTridents(manni);
    const aquamanTridentsQ6 = await getTridents(aquaman);

    expect(nemosTridentsQ6.length).to.eq(1);
    expect(mannisTridentsQ6.length).to.eq(1);
    expect(aquamanTridentsQ6.length).to.eq(1);

    // Manni cannot invoke Nemos membership as Manni is not a host
    await manni.Fact.deleteAll([[nemoId, '$isMemberOf', fishTeam.id!]]);

    const nemosTridentsQ7 = await getTridents(nemo);
    const mannisTridentsQ7 = await getTridents(manni);
    const aquamanTridentsQ7 = await getTridents(aquaman);

    expect(nemosTridentsQ7.length).to.eq(1);
    expect(mannisTridentsQ7.length).to.eq(1);
    expect(aquamanTridentsQ7.length).to.eq(1);

    // Nemo can invoke Mannis membership as he is host
    await nemo.Fact.deleteAll([[manniId, '$isMemberOf', fishTeam.id!]]);

    const nemosTridentsQ8 = await getTridents(nemo);
    const mannisTridentsQ8 = await getTridents(manni);
    const aquamanTridentsQ8 = await getTridents(aquaman);

    expect(nemosTridentsQ8.length).to.eq(1);
    expect(mannisTridentsQ8.length).to.eq(0);
    expect(aquamanTridentsQ8.length).to.eq(1);

    // Aquaman can invoke Nemos membership
    await aquaman.Fact.deleteAll([[nemoId, '$isHostOf', fishTeam.id!]]);

    const nemosTridentsQ9 = await getTridents(nemo);
    const mannisTridentsQ9 = await getTridents(manni);
    const aquamanTridentsQ9 = await getTridents(aquaman);

    expect(nemosTridentsQ9.length).to.eq(0);
    expect(mannisTridentsQ9.length).to.eq(0);
    expect(aquamanTridentsQ9.length).to.eq(1);

    // Aquaman cannot revoke his accountability for the attribute he created.
    // Instead he has to transfer it to somebody else (see next step).
    const aquamanId = await aquaman.getUserIdByEmail(aquaman.email);
    await aquaman.Fact.deleteAll([[aquamanId, '$isAccountableFor', fishTeam.id!]]);

    const nemosTridentsQ10 = await getTridents(nemo);
    const mannisTridentsQ10 = await getTridents(manni);
    const aquamanTridentsQ10 = await getTridents(aquaman);

    expect(nemosTridentsQ10.length).to.eq(0);
    expect(mannisTridentsQ10.length).to.eq(0);
    expect(aquamanTridentsQ10.length).to.eq(1);

    // ... he also cannot transfer the accountability to another user.
    await aquaman.Fact.createAll([[manniId, '$isAccountableFor', fishTeam.id!]]);

    const nemosTridentsQ11 = await getTridents(nemo);
    const mannisTridentsQ11 = await getTridents(manni);
    const aquamanTridentsQ11 = await getTridents(aquaman);

    expect(nemosTridentsQ11.length).to.eq(0);
    expect(mannisTridentsQ11.length).to.eq(0);
    expect(aquamanTridentsQ11.length).to.eq(1);

    // ... Instead he has to transfer it to another group he is is member in.
    await aquaman.Fact.createAll([[fishTeam.id!, '$isAccountableFor', trident.id!]]);
    await aquaman.Fact.createAll([[fishTeam.id!, '$isAccountableFor', fishTeam.id!]]);

    const nemosTridentsQ12 = await getTridents(nemo);
    const mannisTridentsQ12 = await getTridents(manni);
    const aquamanTridentsQ12 = await getTridents(aquaman);

    expect(nemosTridentsQ12.length).to.eq(0);
    expect(mannisTridentsQ12.length).to.eq(0);
    expect(aquamanTridentsQ12.length).to.eq(0);
  });

  it('prevents membership revocation by users who are not host of the group', async () => {
    const [aquaman, nemo, manni] = await Session.getThreeSessions();
    const randomUser = [aquaman, nemo, manni][Math.floor(Math.random() * 3)];

    const nemoId = await randomUser!.getUserIdByEmail(nemo.email);
    const aquamanId = await randomUser!.getUserIdByEmail(nemo.email);

    await randomUser!.Fact.createAll([
      ['Team', '$isATermFor', '...'],
      ['Trident', '$isATermFor', '...'],
    ]);

    const fishTeam = await aquaman.Attribute.createKeyValue({ name: 'fish' }, [['isA', 'Team']]);
    const trident = await aquaman.Attribute.createKeyValue({ name: 'Trident of Atlan' }, [
      ['isA', 'Trident'],
      ['$isMemberOf', fishTeam.id],
    ]);

    expect((await getTeams(nemo)).length).to.eq(0);
    expect((await getTridents(nemo)).length).to.eq(0);
    expect((await getTeams(manni)).length).to.eq(0);
    expect((await getTridents(manni)).length).to.eq(0);
    expect((await getTeams(aquaman)).length).to.eq(1);
    expect((await getTridents(aquaman)).length).to.eq(1);

    await aquaman.Fact.createAll([[nemoId, '$isHostOf', fishTeam.id]]);

    expect((await getTeams(nemo)).length).to.eq(1);
    expect((await getTridents(nemo)).length).to.eq(1);
    expect((await getTeams(manni)).length).to.eq(0);
    expect((await getTridents(manni)).length).to.eq(0);
    expect((await getTeams(aquaman)).length).to.eq(1);
    expect((await getTridents(aquaman)).length).to.eq(1);

    await manni.Fact.deleteAll([[nemoId, '$isHostOf', fishTeam.id!]]);
    await manni.Fact.deleteAll([[nemoId, '$isAccountableFor', fishTeam.id!]]);
    await manni.Fact.deleteAll([[trident.id!, '$isAccountableFor', aquamanId]]);

    expect((await getTeams(nemo)).length).to.eq(1);
    expect((await getTridents(nemo)).length).to.eq(1);
    expect((await getTeams(manni)).length).to.eq(0);
    expect((await getTridents(manni)).length).to.eq(0);
    expect((await getTeams(aquaman)).length).to.eq(1);
    expect((await getTridents(aquaman)).length).to.eq(1);

    await nemo.Fact.deleteAll([[nemoId, '$isAccountableFor', fishTeam.id!]]);
    await nemo.Fact.deleteAll([[trident.id!, '$isAccountableFor', aquamanId]]);
    await nemo.Fact.deleteAll([[nemoId, '$isHostOf', fishTeam.id!]]);

    expect((await getTeams(nemo)).length).to.eq(0);
    expect((await getTridents(nemo)).length).to.eq(0);
    expect((await getTeams(manni)).length).to.eq(0);
    expect((await getTridents(manni)).length).to.eq(0);
    expect((await getTeams(aquaman)).length).to.eq(1);
    expect((await getTridents(aquaman)).length).to.eq(1);
  });

  it('prevents a member can promote himself', async () => {
    const [aquaman, nemo, manni] = await Session.getThreeSessions();
    const randomUser = [aquaman, nemo, manni][Math.floor(Math.random() * 3)];

    const nemoId = await randomUser!.getUserIdByEmail(nemo.email);

    await randomUser!.Fact.createAll([
      ['Team', '$isATermFor', '...'],
      ['Trident', '$isATermFor', '...'],
    ]);

    const fishTeam = await aquaman.Attribute.createKeyValue({ name: 'fish' }, [['isA', 'Team']]);
    await aquaman.Attribute.createKeyValue({ name: 'Trident of Atlan' }, [
      ['isA', 'Trident'],
      ['$isMemberOf', fishTeam.id],
    ]);

    await nemo.Fact.createAll([[nemoId, '$isHostOf', fishTeam.id]]);

    expect((await getTeams(nemo)).length).to.eq(0);
    expect((await getTridents(nemo)).length).to.eq(0);
    expect((await getTeams(manni)).length).to.eq(0);
    expect((await getTridents(manni)).length).to.eq(0);
    expect((await getTeams(aquaman)).length).to.eq(1);
    expect((await getTridents(aquaman)).length).to.eq(1);

    await nemo.Fact.createAll([[nemoId, '$isMemberOf', fishTeam.id]]);

    expect((await getTeams(nemo)).length).to.eq(0);
    expect((await getTridents(nemo)).length).to.eq(0);
    expect((await getTeams(manni)).length).to.eq(0);
    expect((await getTridents(manni)).length).to.eq(0);
    expect((await getTeams(aquaman)).length).to.eq(1);
    expect((await getTridents(aquaman)).length).to.eq(1);

    await manni.Fact.createAll([[nemoId, '$isHostOf', fishTeam.id]]);

    expect((await getTeams(nemo)).length).to.eq(0);
    expect((await getTridents(nemo)).length).to.eq(0);
    expect((await getTeams(manni)).length).to.eq(0);
    expect((await getTridents(manni)).length).to.eq(0);
    expect((await getTeams(aquaman)).length).to.eq(1);
    expect((await getTridents(aquaman)).length).to.eq(1);

    await manni.Fact.createAll([[nemoId, '$isMemberOf', fishTeam.id]]);

    expect((await getTeams(nemo)).length).to.eq(0);
    expect((await getTridents(nemo)).length).to.eq(0);
    expect((await getTeams(manni)).length).to.eq(0);
    expect((await getTridents(manni)).length).to.eq(0);
    expect((await getTeams(aquaman)).length).to.eq(1);
    expect((await getTridents(aquaman)).length).to.eq(1);
  });

  it('does not allow to read the attribute value if the user does not has access', async () => {
    const [aquaman, nemo, manni] = await Session.getThreeSessions();
    const randomUser = [aquaman, nemo, manni][Math.floor(Math.random() * 3)];

    const nemoId = await randomUser!.getUserIdByEmail(nemo.email);

    await randomUser!.Fact.createAll([
      ['Team', '$isATermFor', '...'],
      ['Trident', '$isATermFor', '...'],
    ]);

    const fishTeam = await aquaman.Attribute.createKeyValue({ name: 'fish' }, [['isA', 'Team']]);
    const trident = await aquaman.Attribute.createKeyValue({ name: 'Trident of Atlan' }, [
      ['isA', 'Trident'],
      ['$isMemberOf', fishTeam.id],
    ]);

    await aquaman.Fact.createAll([[nemoId, '$isHostOf', fishTeam.id]]);

    expect((await getTeams(nemo)).length).to.eq(1);
    expect((await getTridents(nemo)).length).to.eq(1);
    expect((await getTeams(manni)).length).to.eq(0);
    expect((await getTridents(manni)).length).to.eq(0);
    expect((await getTeams(aquaman)).length).to.eq(1);
    expect((await getTridents(aquaman)).length).to.eq(1);

    const aquamansResult = await aquaman.Attribute.find(trident.id!);
    const nemosResult = await nemo.Attribute.find(trident.id!);
    const mannisResult = await manni.Attribute.find(trident.id!);

    expect(await aquamansResult!.getValue()).to.eql({ name: 'Trident of Atlan' });
    expect(await nemosResult!.getValue()).to.eql({ name: 'Trident of Atlan' });
    expect(await mannisResult).to.eql(null);
  });

  it('is not possible to use a custom predicate which starts with "$"', async () => {
    const aquaman = await Session.getOneSession();
    await aquaman.Fact.createAll([
      ['Team', '$isATermFor', '...'],
      ['Trident', '$isATermFor', '...'],
    ]);

    await aquaman.Attribute.createKeyValue({ name: 'Trident of Atlan' }, [
      ['isA', 'Trident'],
      ['$isMagicRelictIn', 'Team'],
    ]);

    const { tridents } = await aquaman.Attribute.findAll({
      tridents: [
        ['$isMagicRelictIn', 'Team'],
      ],
    });

    expect(tridents).to.eql([]);
  });

  describe('when the attribute is member of group', () => {
    it('allows any host of the group to use the attribute as subject', async () => {
      const [aquaman, nemo, manni] = await Session.getThreeSessions();
      const randomUser = [aquaman, nemo, manni][Math.floor(Math.random() * 3)];
      const nemoId = await randomUser!.getUserIdByEmail(nemo.email);

      await randomUser!.Fact.createAll([
        ['Team', '$isATermFor', '...'],
        ['Trident', '$isATermFor', '...'],
        ['Weapon', '$isATermFor', '...'],
      ]);

      const fishTeam = await aquaman.Attribute.createKeyValue({ name: 'fish' }, [['isA', 'Team']]);
      const trident = await aquaman.Attribute.createKeyValue({ name: 'Trident of Atlan' }, [
        ['isA', 'Trident'],
        ['$isMemberOf', fishTeam.id],
      ]);

      await nemo.Fact.createAll([[trident.id, 'isA', 'Weapon']]);

      expect((await getTridents(nemo, 'Weapon')).length).to.eql(0);

      await aquaman.Fact.createAll([[nemoId, '$isHostOf', fishTeam.id]]);

      expect((await getTridents(nemo, 'Weapon')).length).to.eql(0);

      await nemo.Fact.createAll([[trident.id, 'isA', 'Weapon']]);

      expect((await getTridents(nemo, 'Weapon')).length).to.eql(1);
      expect((await getTridents(aquaman, 'Weapon')).length).to.eql(1);
      expect((await getTridents(manni, 'Weapon')).length).to.eql(0);
    });

    it('allows any member of the group to use the attribute as subject', async () => {
      const [aquaman, nemo, manni] = await Session.getThreeSessions();
      const randomUser = [aquaman, nemo, manni][Math.floor(Math.random() * 3)];
      const nemoId = await randomUser!.getUserIdByEmail(nemo.email);

      await randomUser!.Fact.createAll([
        ['Team', '$isATermFor', '...'],
        ['Trident', '$isATermFor', '...'],
        ['Weapon', '$isATermFor', '...'],
      ]);

      const fishTeam = await aquaman.Attribute.createKeyValue({ name: 'fish' }, [['isA', 'Team']]);
      const trident = await aquaman.Attribute.createKeyValue({ name: 'Trident of Atlan' }, [
        ['isA', 'Trident'],
        ['$isMemberOf', fishTeam.id],
      ]);

      await nemo.Fact.createAll([[trident.id, 'isA', 'Weapon']]);

      expect((await getTridents(nemo, 'Weapon')).length).to.eql(0);

      await aquaman.Fact.createAll([[nemoId, '$isMemberOf', fishTeam.id]]);

      expect((await getTridents(nemo, 'Weapon')).length).to.eql(0);

      await nemo.Fact.createAll([[trident.id, 'isA', 'Weapon']]);

      expect((await getTridents(nemo, 'Weapon')).length).to.eql(1);
      expect((await getTridents(aquaman, 'Weapon')).length).to.eql(1);
      expect((await getTridents(manni, 'Weapon')).length).to.eql(0);
    });

    it('allows any member of the group to use the attribute as object when creating facts', async () => {
      const [aquaman, nemo, manni] = await Session.getThreeSessions();
      const randomUser = [aquaman, nemo, manni][Math.floor(Math.random() * 3)];
      const nemoId = await randomUser!.getUserIdByEmail(nemo.email);

      await randomUser!.Fact.createAll([
        ['Team', '$isATermFor', '...'],
        ['Trident', '$isATermFor', '...'],
        ['Weapon', '$isATermFor', '...'],
      ]);

      const fishTeam = await aquaman.Attribute.createKeyValue({ name: 'fish' }, [['isA', 'Team']]);

      const trident = await aquaman.Attribute.createKeyValue({ name: 'Trident of Atlan' }, [
        ['isA', 'Trident'],
        ['$isMemberOf', fishTeam.id],
      ]);

      const atlantis = await nemo.Attribute.createKeyValue({ name: 'The City' });

      await nemo.Fact.createAll([[atlantis.id, 'isHomeOf', trident.id]]);
      const { homes } = await nemo.Attribute.findAll({ homes: [['isHomeOf', trident.id!]] });
      expect(homes.length).to.eql(0);

      await aquaman.Fact.createAll([[nemoId, '$isMemberOf', fishTeam.id]]);

      const { homes2 } = await nemo.Attribute.findAll({ homes2: [['isHomeOf', trident.id!]] });
      expect(homes2.length).to.eql(0);

      await nemo.Fact.createAll([[atlantis.id, 'isHomeOf', trident.id]]);

      let nemosHomeMatches = await nemo.Attribute.findAll({ homes: [['isHomeOf', trident.id!]] });
      expect(nemosHomeMatches.homes.length).to.eql(1);

      let amHomeMatches = await aquaman.Attribute.findAll({ homes: [['isHomeOf', trident.id!]] });
      expect(amHomeMatches.homes.length).to.eql(0);

      let mannisHomeMatches = await manni.Attribute.findAll({ homes: [['isHomeOf', trident.id!]] });
      expect(mannisHomeMatches.homes.length).to.eql(0);

      await nemo.Fact.createAll([[atlantis.id, '$isMemberOf', fishTeam.id]]);

      nemosHomeMatches = await nemo.Attribute.findAll({ homes: [['isHomeOf', trident.id!]] });
      expect(nemosHomeMatches.homes.length).to.eql(1);
      amHomeMatches = await aquaman.Attribute.findAll({ homes: [['isHomeOf', trident.id!]] });
      expect(amHomeMatches.homes.length).to.eql(1);
      mannisHomeMatches = await manni.Attribute.findAll({ homes: [['isHomeOf', trident.id!]] });
      expect(mannisHomeMatches.homes.length).to.eql(0);
    });

    it('allows any host of the group to use the attribute as object when creating facts');
    it('allows any member can modify the content of the attribute');
    it('allows any member can read the content of the attribute');

    it('does NOT allow any NON member of the group can use the attribute as subject when creating facts');
    it('does NOT allow any NON member of the group can use the attribute as object when creating facts');
    it('does NOT allow any NON member can modify the content of the attribute');
    it('does NOT allow any NON member can read the content of the attribute');
  });

  describe('when a user transfers the accountability of an attribute', () => {
    it('allows a user to transfer the accountability to another group', async () => {
      const [aquaman, nemo, manni] = await Session.getThreeSessions();
      const randomUser = [aquaman, nemo, manni][Math.floor(Math.random() * 3)];
      const nemoId = await randomUser!.getUserIdByEmail(nemo.email);

      await randomUser!.Fact.createAll([
        ['Team', '$isATermFor', '...'],
        ['Trident', '$isATermFor', '...'],
      ]);

      const fishTeam = await aquaman.Attribute.createKeyValue({ name: 'fish' }, [['isA', 'Team']]);

      const trident = await aquaman.Attribute.createKeyValue({ name: 'Trident of Atlan' }, [
        ['isA', 'Trident'],
        ['$isMemberOf', fishTeam.id],
      ]);

      await aquaman.Fact.createAll([[nemoId, '$isMemberOf', fishTeam.id!]]);
      await aquaman.Fact.createAll([[fishTeam.id!, '$isAccountableFor', trident.id!]]);
      await aquaman.Fact.createAll([[fishTeam.id!, '$isAccountableFor', fishTeam.id!]]);

      expect((await getTridents(aquaman)).length).to.eql(0);
      expect((await getTridents(nemo)).length).to.eql(1);
      expect((await getTridents(manni)).length).to.eql(0);
    });

    it('does not allow to delete accountability facts, it needs to be transferred to another group');

    it('allows a user to transfer the accountability of an attribute from a group to himself');
    it('allows a user to transfer the accountability of an attribute from a group to himself when he does not has access to this group');
    it('allows to specify accountably directly when creating the attribute');

    it('does not allow the user to transfer the accountability to a term');
    it('does not allow to create accountability facts where object  = subject');
    it('does not allow to delete the "isAccountableFor" fact, without assigning accountability to somebody else');

    // how to prevent there is nobody left accountable anymore in a group?
    // should it be possible to make a team accountable for itself?
    // await aquaman.Fact.createAll([[fishTeam.id!, '$isAccountableFor', fishTeam.id!]]);

    describe('a member has been removed from a team', () => {
      it('does not allow the ex member to view/edit/delete the attribute he created and assigned to this team');
    });
  });

  describe('group member discovery', () => {
    it('allows to list all users of a group when the user is member of this group');
    it('does not allow to list all users of a group when the user is not member of this group');
    it('is not possible to find out which groups a user is member in when');
  });

  it('allows to create facts about the authenticated users');
  it('allows to create facts refer to the authenticated users');

  // describe('when used with transitive teams');

  // describe('when a user guessed an attribute id and tries to access it');
});
