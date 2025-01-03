/* eslint-disable max-len */

import { expect } from 'chai';
import LongTextAttribute from '../../src/attributes/long_text/client/index';
import KeyValueAttribute from '../../src/attributes/key_value/client/index';
import {
  createClient, cleanupClients, truncateDB, sleep,
} from '../helpers';

describe('Attribute', () => {
  beforeEach(truncateDB);
  afterEach(cleanupClients);

  describe('Attribute.findAndLoadAll()', () => {
    it('find attributes by facts', async () => {
      const [client] = await createClient();
      const [otherClient] = await createClient();

      const content = await client.Attribute.create('longText', 'the init value');
      const references = await client.Attribute.create('keyValue', { foo: 'bar' });

      const userAB = await client.Attribute.create('keyValue', {});
      const userXX = await client.Attribute.create('keyValue', {});
      const userCB = await client.Attribute.create('keyValue', {});

      const referenceSources1 = await client.Attribute.create('keyValue', { user: 'usr-ab' });
      const referenceSources2 = await client.Attribute.create('keyValue', { user: 'usr-xx' });
      const referenceSources3 = await client.Attribute.create('keyValue', { user: 'usr-cd' });

      await client.Fact.createAll([
        ['referenceStore', '$isATermFor', 'A storage which stores information about references cited in papers'],
        ['referenceSourceStore', '$isATermFor', 'A source of external reference sources'],
      ]);

      await client.Fact.createAll([
        [references.id, 'belongsTo', content.id],
        [references.id, 'isA', 'referenceStore'],
        [referenceSources1.id, 'isA', 'referenceSourceStore'],
        [referenceSources2.id, 'isA', 'referenceSourceStore'],
        [referenceSources3.id, 'isA', 'referenceSourceStore'],
        [referenceSources1.id, 'belongsTo', content.id],
        [referenceSources2.id, 'belongsTo', content.id],
        [referenceSources3.id, 'belongsTo', content.id],
        [referenceSources1.id, 'belongsTo', userAB.id],
        [referenceSources2.id, 'belongsTo', userXX.id],
        [referenceSources3.id, 'belongsTo', userCB.id],
      ]);

      const {
        content: contentAttribute,
        references: [referencesAttribute],
        referenceSources: [referenceSourcesAttribute],
      } = await otherClient.Attribute.findAndLoadAll({
        content: content.id!,
        references: [
          ['belongsTo', content.id!],
          ['isA', 'referenceStore'],
        ],
        referenceSources: [
          ['belongsTo', content.id!],
          ['isA', 'referenceSourceStore'],
          ['belongsTo', userXX.id!],
        ],
      });

      if (!referencesAttribute) {
        throw Error('referencesAttribute is null');
      }

      if (!referenceSourcesAttribute) {
        throw Error('referenceSourcesAttribute is null');
      }

      expect(contentAttribute.value).to.equal('the init value');
      expect(referencesAttribute.value).to.deep.equal({ foo: 'bar' });
      expect(referenceSourcesAttribute.value).to.deep.equal({ user: 'usr-xx' });
    });
  });

  describe('Attribute.findAll()', () => {
    it('find attributes by facts', async () => {
      const [client] = await createClient();
      const [otherClient] = await createClient();

      const content = await client.Attribute.create('longText', 'the init value');
      const references = await client.Attribute.create('keyValue', { foo: 'bar' });

      const userAB = await client.Attribute.create('keyValue', {});
      const userXX = await client.Attribute.create('keyValue', {});
      const userCB = await client.Attribute.create('keyValue', {});

      const referenceSources1 = await client.Attribute.create('keyValue', { user: 'usr-ab' });
      const referenceSources2 = await client.Attribute.create('keyValue', { user: 'usr-xx' });
      const referenceSources3 = await client.Attribute.create('keyValue', { user: 'usr-cd' });

      await client.Fact.createAll([
        ['referenceStore', '$isATermFor', 'A storage which stores information about references cited in papers'],
        ['referenceSourceStore', '$isATermFor', 'A source of external reference sources'],
      ]);

      await client.Fact.createAll([
        [references.id, 'belongsTo', content.id],
        [references.id, 'isA', 'referenceStore'],
        [referenceSources1.id, 'isA', 'referenceSourceStore'],
        [referenceSources2.id, 'isA', 'referenceSourceStore'],
        [referenceSources3.id, 'isA', 'referenceSourceStore'],
        [referenceSources1.id, 'belongsTo', content.id],
        [referenceSources2.id, 'belongsTo', content.id],
        [referenceSources3.id, 'belongsTo', content.id],
        [referenceSources1.id, 'belongsTo', userAB.id],
        [referenceSources2.id, 'belongsTo', userXX.id],
        [referenceSources3.id, 'belongsTo', userCB.id],
      ]);

      const { content: contentAttribute, references: [referencesAttribute], referenceSources: [referenceSourcesAttribute] } = <{
        content: LongTextAttribute,
        references: KeyValueAttribute[],
        referenceSources: KeyValueAttribute[]
      }> <unknown> await otherClient.Attribute.findAll({
        content: content.id!,
        references: [
          ['belongsTo', content.id!],
          ['isA', 'referenceStore'],
        ],
        referenceSources: [
          ['belongsTo', content.id!],
          ['isA', 'referenceSourceStore'],
          ['belongsTo', userXX.id!],
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
      const [client] = await createClient();
      const [otherClient] = await createClient();

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
        throw new Error('id of attribute is not initialized');
      }

      const sameContent = await otherClient.Attribute.find(content.id);
      const sameReferences = await otherClient.Attribute.find(references.id);

      expect(sameContent!.createdAt?.toString()).to.equals(content.createdAt.toString());
      expect(sameReferences!.createdAt?.toString()).to.equals(references.createdAt.toString());

      expect(sameContent!.createdAt?.toString()).to.equals(sameContent!.updatedAt?.toString());
      expect(sameContent!.createdAt?.toString()).to.equals(content.updatedAt?.toString());

      if (!sameContent!.updatedAt) {
        throw new Error('updatedAt is not initialized');
      }

      const beforeUpdatedTime = new Date();
      await sleep(1000);

      expect(beforeUpdatedTime).to.be.greaterThan(content.updatedAt);
      expect(beforeUpdatedTime).to.be.greaterThan(sameContent!.updatedAt);

      await content.set('some change');
      await references.set({ foo: 'bar2' });

      await sleep(1000);

      expect(content.updatedAt).to.be.greaterThan(beforeUpdatedTime);
      expect(sameContent!.updatedAt).to.be.greaterThan(beforeUpdatedTime);

      expect(references.updatedAt).to.be.greaterThan(beforeUpdatedTime);
      expect(sameReferences!.updatedAt).to.be.greaterThan(beforeUpdatedTime);
    });

    it('allows to find attributes by object relations', async () => {
      const [client] = await createClient();
      const [otherClient] = await createClient();

      const userA = await client.Attribute.create('keyValue', {});
      const userB = await client.Attribute.create('keyValue', {});
      const userAB = await client.Attribute.create('keyValue', {});
      const teamA = await client.Attribute.create('keyValue', { name: 'A Team' });
      const teamB = await client.Attribute.create('keyValue', { name: 'B Team' });
      const clubA = await client.Attribute.create('keyValue', { name: 'Club' });

      await client.Fact.createAll([
        ['team', '$isATermFor', 'a group of people'],
        ['club', '$isATermFor', 'a group of people'],
      ]);

      await client.Fact.createAll([
        [teamA.id, 'isA', 'team'],
        [teamB.id, 'isA', 'team'],
        [clubA.id, 'isA', 'club'],
        [userA.id, 'isMemberOf', clubA.id],
        [userA.id, 'isMemberOf', teamA.id],
        [userB.id, 'isMemberOf', teamB.id],
        [userAB.id, 'isMemberOf', teamA.id],
        [userAB.id, 'isMemberOf', teamB.id],
      ]);

      const { allTeamsOfUserA, allTeamsOfUserB, allTeamsOfUserAB } = await otherClient.Attribute.findAll({
        allTeamsOfUserA: [
          ['$it', 'isA', 'team'],
          [userA.id!, 'isMemberOf', '$it'],
        ],
        allTeamsOfUserB: [
          ['$it', 'isA', 'team'],
          [userB.id!, 'isMemberOf', '$it'],
        ],
        allTeamsOfUserAB: [
          ['$it', 'isA', 'team'],
          [userAB.id!, 'isMemberOf', '$it'],
        ],
      });

      expect(allTeamsOfUserA.length).to.equal(1);
      expect(allTeamsOfUserA[0]!.id).to.equal(teamA.id);

      expect(allTeamsOfUserB.length).to.equal(1);
      expect(allTeamsOfUserB[0]!.id).to.equal(teamB.id);

      expect(allTeamsOfUserAB.length).to.equal(2);
    });

    it('allows to find attributes by object relations when there is more then one object "$it" pattern per group to match', async () => {
      const [client] = await createClient();
      const [otherClient] = await createClient();

      const userA = await client.Attribute.create('keyValue', {});
      const userB = await client.Attribute.create('keyValue', {});
      const teamA = await client.Attribute.create('keyValue', { name: 'A Team' });
      const teamB = await client.Attribute.create('keyValue', { name: 'B Team' });
      const teamC = await client.Attribute.create('keyValue', { name: 'C Team' });

      await client.Fact.createAll([
        ['team', '$isATermFor', 'a group of people'],
      ]);

      await client.Fact.createAll([
        [teamA.id, 'isA', 'team'],
        [teamB.id, 'isA', 'team'],
        [teamC.id, 'isA', 'team'],
        [userA.id, 'isMemberOf', teamA.id],
        [userA.id, 'isMemberOf', teamC.id],
        [userB.id, 'isMemberOf', teamB.id],
        [userB.id, 'isMemberOf', teamC.id],
      ]);

      const { allTeamsOfUserA, allTeamsOfUserB, commonTeams } = await otherClient.Attribute.findAll({
        allTeamsOfUserA: [
          ['$it', 'isA', 'team'],
          [userA.id!, 'isMemberOf', '$it'],
        ],
        allTeamsOfUserB: [
          ['$it', 'isA', 'team'],
          [userB.id!, 'isMemberOf', '$it'],
        ],
        commonTeams: [
          ['$it', 'isA', 'team'],
          [userA.id!, 'isMemberOf', '$it'],
          [userB.id!, 'isMemberOf', '$it'],
        ],
      });

      expect(allTeamsOfUserA.length).to.equal(2);
      expect(allTeamsOfUserB.length).to.equal(2);
      expect(commonTeams.length).to.equal(1);

      expect(allTeamsOfUserA.find((attr) => attr.id === teamA.id)).to.not.eq(undefined);
      expect(allTeamsOfUserA.find((attr) => attr.id === teamC.id)).to.not.eq(undefined);

      expect(allTeamsOfUserB.find((attr) => attr.id === teamB.id)).to.not.eq(undefined);
      expect(allTeamsOfUserB.find((attr) => attr.id === teamC.id)).to.not.eq(undefined);
      expect(commonTeams[0]!.id).to.equal(teamC.id);
    });

    it('allows to find attributes by subject relations when there is more then one subject "$it" pattern per group to match', async () => {
      const [client] = await createClient();
      const [otherClient] = await createClient();

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

      const { allMembersOfTeamA, allMembersOfTeamB, commonMembers } = await otherClient.Attribute.findAll({
        allMembersOfTeamA: [
          ['$it', 'isMemberOf', teamA.id!],
        ],
        allMembersOfTeamB: [
          ['$it', 'isMemberOf', teamB.id!],
        ],
        commonMembers: [
          ['$it', 'isMemberOf', teamA.id!],
          ['$it', 'isMemberOf', teamB.id!],
        ],
      });

      expect(allMembersOfTeamA.length).to.equal(2);
      expect(allMembersOfTeamB.length).to.equal(2);
      expect(commonMembers.length).to.equal(1);

      expect(allMembersOfTeamA.find((attr) => attr.id === memberA.id)).to.not.eq(undefined);
      expect(allMembersOfTeamA.find((attr) => attr.id === memberC.id)).to.not.eq(undefined);
      expect(allMembersOfTeamB.find((attr) => attr.id === memberB.id)).to.not.eq(undefined);
      expect(allMembersOfTeamB.find((attr) => attr.id === memberC.id)).to.not.eq(undefined);
      expect(commonMembers[0]!.id).to.equal(memberC.id);
    });

    it('allows to find attributes by datatype', async () => {
      const [client] = await createClient();
      const [otherClient] = await createClient();

      const memberA = await client.Attribute.create('keyValue', { name: 'Paul' });
      const memberB = await client.Attribute.create('longText', 'test');
      const teamA = await client.Attribute.create('keyValue', { name: 'A Team' });

      await client.Fact.createAll([
        [memberA.id, 'isMemberOf', teamA.id],
        [memberB.id, 'isMemberOf', teamA.id],
      ]);

      const { keyValueMembers, longTextMembers } = await otherClient.Attribute.findAll({
        keyValueMembers: [
          ['$it', '$hasDataType', KeyValueAttribute],
          ['$it', 'isMemberOf', teamA.id],
        ],
        longTextMembers: [
          ['$hasDataType', LongTextAttribute],
          ['isMemberOf', teamA.id!],
        ],
      });

      expect(keyValueMembers.find((attr) => attr.id === memberA.id)).to.not.eq(undefined);
      expect(keyValueMembers.find((attr) => attr.id === memberB.id)).to.eq(undefined);

      expect(longTextMembers.find((attr) => attr.id === memberB.id)).to.not.eq(undefined);
      expect(longTextMembers.find((attr) => attr.id === memberA.id)).to.eq(undefined);
    });

    it('returns empty records when the object relations do not exists', async () => {
      const [client] = await createClient();

      await client.Fact.createAll([
        ['team', '$isATermFor', 'a group of people'],
      ]);

      const { allTeamsOfUserA, allTeamsOfUserB } = await client.Attribute.findAll({
        allTeamsOfUserA: [
          ['$it', 'isA', 'team'],
        ],
        allTeamsOfUserB: [
          ['$it', 'isA', 'team'],
        ],
      });

      expect(allTeamsOfUserA.length).to.equal(0);
      expect(allTeamsOfUserB.length).to.equal(0);
    });

    it('supports the $not modifier', async () => {
      const [client] = await createClient();
      const [otherClient] = await createClient();

      const mobyDickVol1 = await client.Attribute.create('keyValue', { title: 'Moby Dick Volume 1' });
      const mobyDickVol2 = await client.Attribute.create('keyValue', { title: 'Moby Dick Volume 2' });
      const mobyDickVol3 = await client.Attribute.create('keyValue', { title: 'Moby Dick Volume 3' });

      await client.Fact.createAll([
        ['deleted', '$isATermFor', 'something that is not existing anymore'],
        ['Book', '$isATermFor', 'some concept'],
        ['Biography', '$isATermFor', 'some concept'],
        ['Autobiography', '$isATermFor', 'some concept'],
      ]);

      await client.Fact.createAll([
        ['Biography', 'isA*', 'Book'],
        ['Autobiography', 'isA*', 'Biography'],

        [mobyDickVol1.id, 'isA*', 'Book'],
        [mobyDickVol2.id, 'isA*', 'Book'],
        [mobyDickVol3.id, 'isA*', 'Book'],

        [mobyDickVol2.id, 'is', 'deleted'],
      ]);

      const { books } = await otherClient.Attribute.findAll({
        books: [
          ['$it', 'isA*', 'Book'],
          ['$it', 'is', '$not(deleted)'],
        ],
      }) as any;

      expect(books.length).to.eq(2);
      expect(books[0].value.title).to.eq('Moby Dick Volume 1');
      expect(books[1].value.title).to.eq('Moby Dick Volume 3');
    });

    it('supports the $not modifier with transitive relationships', async () => {
      const [client] = await createClient();
      const [otherClient] = await createClient();

      const mobyDickVol1 = await client.Attribute.create('keyValue', { title: 'Moby Dick Volume 1' });
      const mobyDickVol2 = await client.Attribute.create('keyValue', { title: 'Moby Dick Volume 2' });
      const mobyDickVol3 = await client.Attribute.create('keyValue', { title: 'Moby Dick Volume 3' });
      const marksAutoBio = await client.Attribute.create('keyValue', { title: 'Autobiography of Mark Twain' });
      const chrisAutoBio = await client.Attribute.create('keyValue', { title: 'Finding Hildasay' });
      const YusraAutoBio = await client.Attribute.create('keyValue', { title: 'Butterfly' });
      const FullersBio = await client.Attribute.create('keyValue', { title: 'Inventor of the Future' });
      const MonksBio = await client.Attribute.create('keyValue', { title: 'Free Press Thelonious Monk' });
      const RalphsBio = await client.Attribute.create('keyValue', { title: 'Ralph Ellison' });

      await client.Fact.createAll([
        ['deleted', '$isATermFor', 'something that is not existing anymore'],

        ['Book', '$isATermFor', 'some concept'],
        ['Biography', '$isATermFor', 'is a book about a persons life'],
        ['Autobiography', '$isATermFor', 'is a biography written by the same person the book is about'],
      ]);

      await client.Fact.createAll([
        ['Biography', 'isA*', 'Book'],
        ['Autobiography', 'isA*', 'Biography'],

        [mobyDickVol1.id, 'isA*', 'Book'],
        [mobyDickVol2.id, 'isA*', 'Book'],
        [mobyDickVol3.id, 'isA*', 'Book'],
        [marksAutoBio.id, 'isA*', 'Autobiography'],
        [chrisAutoBio.id, 'isA*', 'Autobiography'],
        [YusraAutoBio.id, 'isA*', 'Autobiography'],

        [FullersBio.id, 'isA*', 'Biography'],
        [MonksBio.id, 'isA*', 'Biography'],
        [RalphsBio.id, 'isA*', 'Biography'],

        [mobyDickVol2.id, 'is', 'deleted'],
        [chrisAutoBio.id, 'is', 'deleted'],
        [RalphsBio.id, 'is', 'deleted'],
      ]);

      const {
        books, bios, autobios, allBooks, allBios, allAutobios,
      } = await otherClient.Attribute.findAll({
        books: [
          ['$it', 'isA*', 'Book'],
          ['$it', 'is', '$not(deleted)'],
        ],
        bios: [
          ['$it', 'isA*', 'Biography'],
          ['$it', 'is', '$not(deleted)'],
        ],
        autobios: [
          ['$it', 'isA*', 'Autobiography'],
          ['$it', 'is', '$not(deleted)'],
        ],
        allBooks: [
          ['$it', 'isA*', 'Book'],
        ],
        allBios: [
          ['$it', 'isA*', 'Biography'],
        ],
        allAutobios: [
          ['$it', 'isA*', 'Autobiography'],
        ],
      }) as any;

      expect(allBooks.length).to.eq(9);
      expect(allBios.length).to.eq(6);
      expect(allAutobios.length).to.eq(3);

      expect(books.length).to.eq(6);
      expect(bios.length).to.eq(4);
      expect(autobios.length).to.eq(2);

      expect(books[0].value.title).to.eq('Moby Dick Volume 1');
      expect(books[1].value.title).to.eq('Moby Dick Volume 3');
    });

    it('supports the $latest and $not modifier for object', async () => {
      const [client] = await createClient();
      const [otherClient] = await createClient();

      const mobyDickVol1 = await client.Attribute.create('keyValue', { title: 'Moby Dick Volume 1' });
      const mobyDickVol2 = await client.Attribute.create('keyValue', { title: 'Moby Dick Volume 2' });
      const mobyDickVol3 = await client.Attribute.create('keyValue', { title: 'Moby Dick Volume 3' });
      const marksAutoBio = await client.Attribute.create('keyValue', { title: 'Autobiography of Mark Twain' });
      const chrisAutoBio = await client.Attribute.create('keyValue', { title: 'Finding Hildasay' });
      const YusraAutoBio = await client.Attribute.create('keyValue', { title: 'Butterfly' });
      const FullersBio = await client.Attribute.create('keyValue', { title: 'Inventor of the Future' });
      const MonksBio = await client.Attribute.create('keyValue', { title: 'Free Press Thelonious Monk' });
      const RalphsBio = await client.Attribute.create('keyValue', { title: 'Ralph Ellison' });

      const shelf1 = await client.Attribute.create('keyValue', { title: 'a shelf' });

      await client.Fact.createAll([
        ['inTrasbin', '$isATermFor', 'a state meaning it is marked to be deleted'],
        ['visiable', '$isATermFor', 'a state meaning it is not marked to be deleted'],
        ['superVisiable', '$isATermFor', 'a state meaning introduced for testing only'],

        ['Shelf', '$isATermFor', 'a thing holding books'],

        ['Book', '$isATermFor', 'some concept'],
        ['Biography', '$isATermFor', 'is a book about a persons life'],
        ['Autobiography', '$isATermFor', 'is a biography written by the same person the book is about'],
      ]);

      await client.Fact.createAll([
        ['Biography', 'isA*', 'Book'],
        ['Autobiography', 'isA*', 'Biography'],

        ['Book', 'isA*', 'Autobiography'], // does it detect cylces?

        [shelf1.id, 'isA*', 'Shelf'],

        [mobyDickVol1.id, 'isA*', 'Book'],
        [mobyDickVol2.id, 'isA*', 'Book'],
        [mobyDickVol3.id, 'isA*', 'Book'],
        [marksAutoBio.id, 'isA*', 'Autobiography'],
        [chrisAutoBio.id, 'isA*', 'Autobiography'],
        [YusraAutoBio.id, 'isA*', 'Autobiography'],

        [FullersBio.id, 'isA*', 'Biography'],
        [MonksBio.id, 'isA*', 'Biography'],
        [RalphsBio.id, 'isA*', 'Biography'],

        [mobyDickVol3.id, 'delitionStateIs', 'inTrasbin'],
        [mobyDickVol3.id, 'delitionStateIs', 'superVisiable'],

        [mobyDickVol1.id, 'delitionStateIs', 'inTrasbin'],
        [mobyDickVol1.id, 'delitionStateIs', 'visiable'],

        // This should lead to be deleted
        [mobyDickVol2.id, 'delitionStateIs', 'inTrasbin'],
        [mobyDickVol2.id, 'delitionStateIs', 'visiable'],
        [mobyDickVol2.id, 'delitionStateIs', 'inTrasbin'],

        [chrisAutoBio.id, 'delitionStateIs', 'inTrasbin'],
        [chrisAutoBio.id, 'delitionStateIs', 'visiable'],
        [chrisAutoBio.id, 'delitionStateIs', 'inTrasbin'],

        [RalphsBio.id, 'delitionStateIs', 'inTrasbin'],
      ]);

      const {
        booksInTrasbin,
        booksNotInTrasbin,
      } = await otherClient.Attribute.findAll({
        booksInTrasbin: [
          ['$it', 'isA*', 'Book'],
          ['$it', '$latest(delitionStateIs)', 'inTrasbin'],
        ],
        booksNotInTrasbin: [
          ['$it', 'isA*', 'Book'],
          ['$it', '$latest(delitionStateIs)', '$not(inTrasbin)'],
        ],
      }) as any;

      expect(booksInTrasbin.length).to.eq(3);
      expect(booksNotInTrasbin.length).to.eq(6);

      [RalphsBio, chrisAutoBio, mobyDickVol2].forEach((book) => {
        const fromResults = booksInTrasbin.find((b) => b.id === book.id);
        expect(fromResults.id).to.eql(book.id);
      });

      [mobyDickVol1, mobyDickVol3, marksAutoBio, YusraAutoBio, FullersBio, MonksBio].forEach((book) => {
        expect(booksNotInTrasbin.find((b) => b.id === book.id).id).to.eql(book.id);
      });
    });

    // Already implemented
    it('supports the $not modifier when object is $it');

    it('can be executed in parallel', async () => {
      const [client] = await createClient();
      const [otherClient] = await createClient();

      const userAB = await client.Attribute.create('keyValue', {});
      const userXX = await client.Attribute.create('keyValue', {});
      const userCB = await client.Attribute.create('keyValue', {});

      const content = await client.Attribute.create('longText', 'the init value');
      const references = await client.Attribute.create('keyValue', { foo: 'bar' });
      const referenceSources1 = await client.Attribute.create('keyValue', { user: 'usr-ab' });
      const referenceSources2 = await client.Attribute.create('keyValue', { user: 'usr-xx' });
      const referenceSources3 = await client.Attribute.create('keyValue', { user: 'usr-cd' });

      await client.Fact.createAll([
        ['referenceStore', '$isATermFor', 'A storage which stores information about references cited in papers'],
        ['referenceSourceStore', '$isATermFor', 'A source of external reference sources'],
      ]);

      await client.Fact.createAll([
        [references.id, 'belongsTo', content.id],
        [references.id, 'isA', 'referenceStore'],
        [referenceSources1.id, 'isA', 'referenceSourceStore'],
        [referenceSources2.id, 'isA', 'referenceSourceStore'],
        [referenceSources3.id, 'isA', 'referenceSourceStore'],
        [referenceSources1.id, 'belongsTo', content.id],
        [referenceSources2.id, 'belongsTo', content.id],
        [referenceSources3.id, 'belongsTo', content.id],
        [referenceSources1.id, 'belongsTo', userAB.id],
        [referenceSources2.id, 'belongsTo', userXX.id],
        [referenceSources3.id, 'belongsTo', userCB.id],
      ]);

      if (content.id == null) {
        throw Error('id is null');
      }

      const exec1 = otherClient.Attribute.findAll({
        content: content.id,
        references: [
          ['belongsTo', content.id],
          ['isA', 'referenceStore'],
        ],
        referenceSources: [
          ['belongsTo', content.id],
          ['isA', 'referenceSourceStore'],
          ['belongsTo', userXX.id!],
        ],
      });

      const exec2 = otherClient.Attribute.findAll({
        content: content.id,
        references: [
          ['belongsTo', content.id],
          ['isA', 'referenceStore'],
        ],
        referenceSources: [
          ['belongsTo', content.id],
          ['isA', 'referenceSourceStore'],
          ['belongsTo', userXX.id!],
        ],
      });

      const { content: contentAttribute1, references: [referencesAttribute1], referenceSources: [referenceSourcesAttribute1] } = await exec1;
      const { content: contentAttribute2, references: [referencesAttribute2], referenceSources: [referenceSourcesAttribute2] } = await exec2;

      expect(await contentAttribute1.getValue()).to.equal('the init value');
      expect(await referencesAttribute1!.getValue()).to.deep.equal({ foo: 'bar' });
      expect(await referenceSourcesAttribute1!.getValue()).to.deep.equal({ user: 'usr-xx' });

      expect(await contentAttribute2.getValue()).to.equal('the init value');
      expect(await referencesAttribute2!.getValue()).to.deep.equal({ foo: 'bar' });
      expect(await referenceSourcesAttribute2!.getValue()).to.deep.equal({ user: 'usr-xx' });
    });

    it('returns an empty array when the attribute does not exists', async () => {
      const [client] = await createClient();

      await client.Fact.createAll([
        ['notExisting', '$isATermFor', 'a dummy concept for testing'],
      ]);

      const { content: contentAttribute, references } = <{
        content: LongTextAttribute,
        references: KeyValueAttribute[],
      }> await client.Attribute.findAll({
        content: 'not-existing',
        references: [
          ['isA', 'notExisting'],
        ],
      });

      expect(contentAttribute).to.equal(undefined);
      expect(references.length).to.equal(0);
    });
  });
});
