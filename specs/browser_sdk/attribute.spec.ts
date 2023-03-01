/* eslint-disable max-len */

import { expect } from 'chai';
import { v4 as uuid } from 'uuid';
import LinkedRecords from '../../src/browser_sdk';
import ServerSideEvents from '../../lib/server-side-events/client';
import LongTextAttribute from '../../src/attributes/long_text/client/index';
import KeyValueAttribute from '../../src/attributes/key_value/client/index';

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

let clients: LinkedRecords[] = [];

function createClient(): [LinkedRecords, ServerSideEvents] {
  const serverSideEvents = new ServerSideEvents();
  const client = new LinkedRecords(
    new URL('http://localhost:3000'),
    serverSideEvents,
  );

  client.actorId = uuid();

  clients.push(client);
  return [client, serverSideEvents];
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

  describe('Attribute.findAll()', () => {
    it('find attributes by facts', async () => {
      const [client] = createClient();
      const [otherClient] = createClient();

      const content = await client.Attribute.create('longText', 'the init value');
      const references = await client.Attribute.create('keyValue', { foo: 'bar' });
      const referenceSources1 = await client.Attribute.create('keyValue', { user: 'usr-ab' });
      const referenceSources2 = await client.Attribute.create('keyValue', { user: 'usr-xx' });
      const referenceSources3 = await client.Attribute.create('keyValue', { user: 'usr-cd' });

      await client.Fact.createAll([
        [references.id, 'belongsTo', content.id],
        [references.id, 'isA', 'referenceStore'],
        [referenceSources1.id, 'isA', 'referenceSourceStore'],
        [referenceSources2.id, 'isA', 'referenceSourceStore'],
        [referenceSources3.id, 'isA', 'referenceSourceStore'],
        [referenceSources1.id, 'belongsTo', content.id],
        [referenceSources2.id, 'belongsTo', content.id],
        [referenceSources3.id, 'belongsTo', content.id],
        [referenceSources1.id, 'belongsTo', 'usr-ab'],
        [referenceSources2.id, 'belongsTo', 'usr-xx'],
        [referenceSources3.id, 'belongsTo', 'usr-cd'],
      ]);

      if (content.id == null) {
        throw Error('id is null');
      }

      const { content: contentAttribute, refernces: [referencesAttribute], referenceSources: [referenceSourcesAttribute] } = <{
        content: LongTextAttribute,
        refernces: KeyValueAttribute[],
        referenceSources: KeyValueAttribute[]
      }> <unknown> await otherClient.Attribute.findAll({
        content: content.id,
        refernces: [
          ['belongsTo', content.id],
          ['isA', 'referenceStore'],
        ],
        referenceSources: [
          ['belongsTo', content.id],
          ['isA', 'referenceSourceStore'],
          ['belongsTo', 'usr-xx'],
        ],
      });

      if (!referencesAttribute) {
        throw Error('referencesAttribute is null');
      }

      if (!referenceSourcesAttribute) {
        throw Error('referenceSourcesAttribute is null');
      }

      expect(await contentAttribute.getValue()).to.equal('the init value');
      expect(await referencesAttribute.getValue()).to.deep.equal({ foo: 'bar' });
      expect(await referenceSourcesAttribute.getValue()).to.deep.equal({ user: 'usr-xx' });
    });

    it('returns information about creation and update time', async () => {
      const [client] = createClient();
      const [otherClient] = createClient();

      const beforeCreationTime = new Date();

      await sleep(1000);

      const content = await client.Attribute.create('longText', 'the init value');
      const references = await client.Attribute.create('keyValue', { foo: 'bar' });
      const afterCreationTime = new Date();

      if (!content.createdAt || !references.createdAt || !references.updatedAt || !content.updatedAt) {
        throw new Error('createdAt or updatedAt is undefined');
      }

      expect(content.createdAt).to.be.greaterThan(beforeCreationTime);
      expect(afterCreationTime).to.be.greaterThan(content.createdAt);
      expect(references.createdAt).to.be.greaterThan(beforeCreationTime);
      expect(afterCreationTime).to.be.greaterThan(references.createdAt);

      expect(afterCreationTime).to.be.greaterThan(references.updatedAt);
      expect(afterCreationTime).to.be.greaterThan(content.updatedAt);

      if (!content.id || !references.id) {
        throw new Error('id of attribute is not initilized');
      }

      const sameContent = await otherClient.Attribute.find(content.id);
      const sameReferences = await otherClient.Attribute.find(references.id);

      expect(sameContent.createdAt?.toString()).to.equals(content.createdAt.toString());
      expect(sameReferences.createdAt?.toString()).to.equals(references.createdAt.toString());

      expect(sameContent.createdAt?.toString()).to.equals(sameContent.updatedAt?.toString());
      expect(sameContent.createdAt?.toString()).to.equals(content.updatedAt?.toString());

      if (!sameContent.updatedAt) {
        throw new Error('updatedAt is not initilized');
      }

      const beforeUpdatedTime = new Date();
      await sleep(1000);

      expect(beforeUpdatedTime).to.be.greaterThan(content.updatedAt);
      expect(beforeUpdatedTime).to.be.greaterThan(sameContent.updatedAt);

      await content.set('some change');
      await references.set({ foo: 'bar2' });

      await sleep(1000);

      expect(content.updatedAt).to.be.greaterThan(beforeUpdatedTime);
      expect(sameContent.updatedAt).to.be.greaterThan(beforeUpdatedTime);

      expect(references.updatedAt).to.be.greaterThan(beforeUpdatedTime);
      expect(sameReferences.updatedAt).to.be.greaterThan(beforeUpdatedTime);
    });

    it('allows to find attributes by object relations', async () => {
      const [client] = createClient();
      const [otherClient] = createClient();

      const teamA = await client.Attribute.create('keyValue', { name: 'A Team' });
      const teamB = await client.Attribute.create('keyValue', { name: 'B Team' });
      const clubA = await client.Attribute.create('keyValue', { name: 'Club' });

      await client.Fact.createAll([
        [teamA.id, 'isA', 'team'],
        [teamB.id, 'isA', 'team'],
        [clubA.id, 'isA', 'club'],
        ['user-a', 'isMemberOf', clubA.id],
        ['user-a', 'isMemberOf', teamA.id],
        ['user-b', 'isMemberOf', teamB.id],
        ['user-ab', 'isMemberOf', teamA.id],
        ['user-ab', 'isMemberOf', teamB.id],
      ]);

      const teams = await otherClient.Attribute.findAll({
        allTeamsOfUserA: [
          ['$it', 'isA', 'team'],
          ['user-a', 'isMemberOf', '$it'],
        ],
        allTeamsOfUserB: [
          ['$it', 'isA', 'team'],
          ['user-b', 'isMemberOf', '$it'],
        ],
        allTeamsOfUserAB: [
          ['$it', 'isA', 'team'],
          ['user-ab', 'isMemberOf', '$it'],
        ],
      });

      const { allTeamsOfUserA, allTeamsOfUserB, allTeamsOfUserAB } = <{
        allTeamsOfUserA: KeyValueAttribute[],
        allTeamsOfUserB: KeyValueAttribute[],
        allTeamsOfUserAB: KeyValueAttribute[],
      }> <unknown> teams;

      expect(allTeamsOfUserA.length).to.equal(1);
      expect(allTeamsOfUserA[0]!.id).to.equal(teamA.id);

      expect(allTeamsOfUserB.length).to.equal(1);
      expect(allTeamsOfUserB[0]!.id).to.equal(teamB.id);

      expect(allTeamsOfUserAB.length).to.equal(2);
    });

    it('allows to find attributes by object relations when there is more then one object "$it" pattern per group to match', async () => {
      const [client] = createClient();
      const [otherClient] = createClient();

      const teamA = await client.Attribute.create('keyValue', { name: 'A Team' });
      const teamB = await client.Attribute.create('keyValue', { name: 'B Team' });
      const teamC = await client.Attribute.create('keyValue', { name: 'C Team' });

      await client.Fact.createAll([
        [teamA.id, 'isA', 'team'],
        [teamB.id, 'isA', 'team'],
        [teamC.id, 'isA', 'team'],
        ['user-a', 'isMemberOf', teamA.id],
        ['user-a', 'isMemberOf', teamC.id],
        ['user-b', 'isMemberOf', teamB.id],
        ['user-b', 'isMemberOf', teamC.id],
      ]);

      const teams = await otherClient.Attribute.findAll({
        allTeamsOfUserA: [
          ['$it', 'isA', 'team'],
          ['user-a', 'isMemberOf', '$it'],
        ],
        allTeamsOfUserB: [
          ['$it', 'isA', 'team'],
          ['user-b', 'isMemberOf', '$it'],
        ],
        commonTeams: [
          ['$it', 'isA', 'team'],
          ['user-a', 'isMemberOf', '$it'],
          ['user-b', 'isMemberOf', '$it'],
        ],
      });

      const { allTeamsOfUserA, allTeamsOfUserB, commonTeams } = <{
        allTeamsOfUserA: KeyValueAttribute[],
        allTeamsOfUserB: KeyValueAttribute[],
        commonTeams: KeyValueAttribute[],
      }> <unknown> teams;

      expect(allTeamsOfUserA.length).to.equal(2);
      expect(allTeamsOfUserB.length).to.equal(2);
      expect(commonTeams.length).to.equal(1);

      expect(allTeamsOfUserA.find((attr) => attr.id === teamA.id));
      expect(allTeamsOfUserA.find((attr) => attr.id === teamC.id));

      expect(allTeamsOfUserB.find((attr) => attr.id === teamB.id));
      expect(allTeamsOfUserB.find((attr) => attr.id === teamC.id));
      expect(commonTeams[0]!.id).to.equal(teamC.id);
    });

    it('allows to find attributes by subject relations when there is more then one subject "$it" pattern per group to match', async () => {
      const [client] = createClient();
      const [otherClient] = createClient();

      const memberA = await client.Attribute.create('keyValue', { name: 'Paul' });
      const memberB = await client.Attribute.create('keyValue', { name: 'Peter' });
      const memberC = await client.Attribute.create('keyValue', { name: 'Petera' });

      const teamA = await client.Attribute.create('keyValue', { name: 'A Team' });
      const teamB = await client.Attribute.create('keyValue', { name: 'B Team' });

      await client.Fact.createAll([
        [memberA.id, 'isMemberOf', teamA.id],
        [memberB.id, 'isMemberOf', teamB.id],

        [memberC.id, 'isMemberOf', teamA.id],
        [memberC.id, 'isMemberOf', teamB.id],
      ]);

      const users = await otherClient.Attribute.findAll({
        allMembersOfTeamA: [
          ['$it', 'isMemberOf', teamA.id as string],
        ],
        allMembersOfTeamB: [
          ['$it', 'isMemberOf', teamB.id as string],
        ],
        commonMembers: [
          ['$it', 'isMemberOf', teamA.id as string],
          ['$it', 'isMemberOf', teamB.id as string],
        ],
      });

      const { allMembersOfTeamA, allMembersOfTeamB, commonMembers } = <{
        allMembersOfTeamA: KeyValueAttribute[],
        allMembersOfTeamB: KeyValueAttribute[],
        commonMembers: KeyValueAttribute[],
      }> <unknown> users;

      expect(allMembersOfTeamA.length).to.equal(2);
      expect(allMembersOfTeamB.length).to.equal(2);
      expect(commonMembers.length).to.equal(1);

      expect(allMembersOfTeamA.find((attr) => attr.id === memberA.id));
      expect(allMembersOfTeamA.find((attr) => attr.id === memberC.id));
      expect(allMembersOfTeamB.find((attr) => attr.id === memberB.id));
      expect(allMembersOfTeamB.find((attr) => attr.id === memberC.id));
      expect(commonMembers[0]!.id).to.equal(memberC.id);
    });

    it('returns empty records when the object relations do not exists', async () => {
      const [client] = createClient();

      const teams = await client.Attribute.findAll({
        allTeamsOfUserA: [
          ['$it', 'isA', 'team'],
        ],
        allTeamsOfUserB: [
          ['$it', 'isA', 'team'],
        ],
      });

      const { allTeamsOfUserA, allTeamsOfUserB } = <{
        allTeamsOfUserA: KeyValueAttribute[],
        allTeamsOfUserB: KeyValueAttribute[],
      }> <unknown> teams;

      expect(allTeamsOfUserA.length).to.equal(0);
      expect(allTeamsOfUserB.length).to.equal(0);
    });

    it('can be executed in parallel', async () => {
      const [client] = createClient();
      const [otherClient] = createClient();

      const content = await client.Attribute.create('longText', 'the init value');
      const references = await client.Attribute.create('keyValue', { foo: 'bar' });
      const referenceSources1 = await client.Attribute.create('keyValue', { user: 'usr-ab' });
      const referenceSources2 = await client.Attribute.create('keyValue', { user: 'usr-xx' });
      const referenceSources3 = await client.Attribute.create('keyValue', { user: 'usr-cd' });

      await client.Fact.createAll([
        [references.id, 'belongsTo', content.id],
        [references.id, 'isA', 'referenceStore'],
        [referenceSources1.id, 'isA', 'referenceSourceStore'],
        [referenceSources2.id, 'isA', 'referenceSourceStore'],
        [referenceSources3.id, 'isA', 'referenceSourceStore'],
        [referenceSources1.id, 'belongsTo', content.id],
        [referenceSources2.id, 'belongsTo', content.id],
        [referenceSources3.id, 'belongsTo', content.id],
        [referenceSources1.id, 'belongsTo', 'usr-ab'],
        [referenceSources2.id, 'belongsTo', 'usr-xx'],
        [referenceSources3.id, 'belongsTo', 'usr-cd'],
      ]);

      if (content.id == null) {
        throw Error('id is null');
      }

      const exec1 = otherClient.Attribute.findAll({
        content: content.id,
        refernces: [
          ['belongsTo', content.id],
          ['isA', 'referenceStore'],
        ],
        referenceSources: [
          ['belongsTo', content.id],
          ['isA', 'referenceSourceStore'],
          ['belongsTo', 'usr-xx'],
        ],
      });

      const exec2 = otherClient.Attribute.findAll({
        content: content.id,
        refernces: [
          ['belongsTo', content.id],
          ['isA', 'referenceStore'],
        ],
        referenceSources: [
          ['belongsTo', content.id],
          ['isA', 'referenceSourceStore'],
          ['belongsTo', 'usr-xx'],
        ],
      });

      const { content: contentAttribute1, refernces: [referencesAttribute1], referenceSources: [referenceSourcesAttribute1] } = <{
        content: LongTextAttribute,
        refernces: KeyValueAttribute[],
        referenceSources: KeyValueAttribute[]
      }> <unknown> await exec1;

      const { content: contentAttribute2, refernces: [referencesAttribute2], referenceSources: [referenceSourcesAttribute2] } = <{
        content: LongTextAttribute,
        refernces: KeyValueAttribute[],
        referenceSources: KeyValueAttribute[]
      }> <unknown> await exec2;

      if (!referencesAttribute1 || !referencesAttribute2) {
        throw Error('referencesAttribute is null');
      }

      if (!referenceSourcesAttribute1 || !referenceSourcesAttribute2) {
        throw Error('referenceSourcesAttribute is null');
      }

      expect(await contentAttribute1.getValue()).to.equal('the init value');
      expect(await referencesAttribute1.getValue()).to.deep.equal({ foo: 'bar' });
      expect(await referenceSourcesAttribute1.getValue()).to.deep.equal({ user: 'usr-xx' });

      expect(await contentAttribute2.getValue()).to.equal('the init value');
      expect(await referencesAttribute2.getValue()).to.deep.equal({ foo: 'bar' });
      expect(await referenceSourcesAttribute2.getValue()).to.deep.equal({ user: 'usr-xx' });
    });

    it('returns an empty array when the attribute does not exists', async () => {
      const [client] = createClient();

      const { content: contentAttribute, refernces } = <{
        content: LongTextAttribute,
        refernces: KeyValueAttribute[],
      }> <unknown> await client.Attribute.findAll({
        content: 'not exsting',
        refernces: [
          ['isA', 'notExsting'],
        ],
      });

      expect(contentAttribute).to.equal(null);
      expect(refernces.length).to.equal(0);
    });
  });
});
