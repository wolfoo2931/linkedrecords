// This file demonstrates and tests the usage of tinytodo.ts

// This tests spins up multiple browser windows and signs in a different user in
// each browser window. The browser management is based on webdriver.io and implemented
// in ../helpers/session'.

import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import Session from '../helpers/session';
import TinyTodo from './tinytodo';
import {
  expectNotToBeAbleToChangeList,
  expectNotToBeAbleToSeeList,
  expectNotToBeAbleToSeeListsOfOrg,
  expectToBeAbleToSeeList,
  expectToBeAbleToSeeListsOfOrg,
  expectToBeAbleToSeeTask,
} from './tinytodo_expects';

chai.use(chaiAsPromised);

async function setUpOrg({ admins, temps, interns }) {
  const oneAdmin = admins[0];
  const allUsers = [...admins, ...temps, ...interns];
  const randomUser = allUsers[Math.floor(Math.random() * allUsers.length)];

  if (!oneAdmin) {
    throw new Error('No admin found');
  }

  await TinyTodo.ensureTerminologyIsDefined(randomUser);

  const {
    org,
    adminTeam,
    tempTeam,
    internTeam,
  } = await TinyTodo.createOrg(oneAdmin, 'TinyTodo Org');

  const orgID = org?.id;
  const adminTeamID = adminTeam?.id;
  const tempTeamID = tempTeam?.id;
  const internTeamID = internTeam?.id;

  if (!orgID) {
    throw new Error('Org not created');
  }

  await Promise.all(admins.map(async (c) => {
    const userId = await c.getActorId();
    await TinyTodo.addUserToOrg(oneAdmin, userId, orgID, adminTeamID);
  }));

  await Promise.all(temps.map(async (c) => {
    const userId = await c.getActorId();
    await TinyTodo.addUserToOrg(oneAdmin, userId, orgID, tempTeamID);
  }));

  await Promise.all(interns.map(async (c) => {
    const userId = await c.getActorId();
    await TinyTodo.addUserToOrg(oneAdmin, userId, orgID, internTeamID);
  }));

  return {
    orgID, adminTeamID, tempTeamID, internTeamID,
  };
}

describe('TinyTodo', () => {
  beforeEach(Session.truncateDB);
  afterEach(Session.afterEach);
  after(Session.deleteBrowsers);

  it('allows to share a list with a user directly', async () => {
    const [emina, andrew, kescha] = await Session.getThreeSessions();
    const eminasUserId = await emina.getActorId();
    const randomUser = [emina, andrew, kescha][Math.floor(Math.random() * 3)];

    if (!randomUser) {
      throw new Error('No random user found');
    }

    await TinyTodo.ensureTerminologyIsDefined(randomUser);

    // Andrew can query all lists independent of an org
    expect(await TinyTodo.getLists(andrew)).to.have.length(0);
    expect(await TinyTodo.getLists(emina)).to.have.length(0);

    // Andrew can create his own list without assigning it to an org
    const andrewsListId = await TinyTodo.createList(andrew, 'Andrews List');

    await expectToBeAbleToSeeList(andrew, andrewsListId);
    await expectNotToBeAbleToSeeList(emina, andrewsListId);
    await expectNotToBeAbleToSeeList(kescha, andrewsListId);

    // Andrew shares his list with Emina as read only
    await TinyTodo.shareList(andrew, andrewsListId, eminasUserId, true);

    await expectToBeAbleToSeeList(andrew, andrewsListId);
    await expectToBeAbleToSeeList(emina, andrewsListId);
    await expectNotToBeAbleToSeeList(kescha, andrewsListId);

    await expectNotToBeAbleToChangeList(emina, andrewsListId, randomUser);

    // Andrew is allowed to create a task in his list and Emina sees the task
    await TinyTodo.createTask(andrew, andrewsListId, 'Task created by Andrew');
    await expectToBeAbleToSeeTask(emina, andrewsListId, 'Task created by Andrew');

    // Andrew can unshare the list with Emina
    await TinyTodo.unshareList(andrew, andrewsListId, eminasUserId, true);
    await expectToBeAbleToSeeList(andrew, andrewsListId);
    await expectNotToBeAbleToSeeList(emina, andrewsListId);
    await expectNotToBeAbleToSeeList(kescha, andrewsListId);

    // Andrew shares full access to his list with Emina so she can create tasks
    await TinyTodo.shareList(andrew, andrewsListId, eminasUserId, false);
    await TinyTodo.createTask(emina, andrewsListId, 'Task created by Emina');
    await expectToBeAbleToSeeList(andrew, andrewsListId);
    await expectToBeAbleToSeeList(emina, andrewsListId);
    await expectNotToBeAbleToSeeList(kescha, andrewsListId);
    await expectToBeAbleToSeeTask(andrew, andrewsListId, 'Task created by Emina');
    await expectToBeAbleToSeeTask(emina, andrewsListId, 'Task created by Emina');
  });

  it('allows to setup permissions for an organization', async () => {
    const [emina, andrew, kescha, aaron] = await Session.getFourSessions();

    const { orgID } = await setUpOrg({
      admins: [emina],
      temps: [kescha],
      interns: [aaron],
    });

    // Emina can create a list because she is a temp
    const listCreatedByEmina = await TinyTodo.createList(emina, 'Org list created by Emina', orgID);

    await expectToBeAbleToSeeList(emina, listCreatedByEmina);
    await expectToBeAbleToSeeList(kescha, listCreatedByEmina);
    await expectToBeAbleToSeeList(aaron, listCreatedByEmina);

    // Kescha can create a list because she is a temp
    const listCreatedByKescha = await TinyTodo.createList(kescha, 'Org list created by Kescha', orgID);

    await expectToBeAbleToSeeList(emina, listCreatedByKescha);
    await expectToBeAbleToSeeList(kescha, listCreatedByKescha);
    await expectToBeAbleToSeeList(aaron, listCreatedByKescha);

    await expect(TinyTodo.createList(aaron, 'Org list created by Aaron', orgID))
      .to.eventually.be.rejectedWith(Error, 'list not created');

    // Andrew is not part of the org so he can not get lists
    await expectNotToBeAbleToSeeListsOfOrg(andrew, orgID);

    // Andrew is not part of the org so he can not create a list
    await expect(TinyTodo.createList(andrew, 'Andrews List', orgID))
      .to.eventually.be.rejectedWith(Error, 'list of list not found');

    // Interns should not be allowed to create a list (in context of an organization)
    await expect(TinyTodo.createList(aaron, 'Aarons List', orgID))
      .to.eventually.be.rejectedWith(Error, 'list not created');
  });

  it('allows only admins to add other users to the orgs temp team', async () => {
    const [emina, andrew, kescha, aaron] = await Session.getFourSessions();

    const { orgID, tempTeamID } = await setUpOrg({
      admins: [emina],
      temps: [kescha],
      interns: [aaron],
    });

    const listCreatedByKescha = await TinyTodo.createList(kescha, 'Org list created by Kescha', orgID);

    await expectNotToBeAbleToSeeListsOfOrg(andrew, orgID);
    await expectNotToBeAbleToSeeList(andrew, listCreatedByKescha);

    await expect(TinyTodo.addUserToOrg(kescha, await andrew.getActorId(), orgID, tempTeamID))
      .to.eventually.be.rejectedWith(Error, 'Not Authorized to assign user to team');

    await expect(TinyTodo.addUserToOrg(andrew, await andrew.getActorId(), orgID, tempTeamID))
      .to.eventually.be.rejectedWith(Error, 'Not Authorized to assign user to team');

    await expect(TinyTodo.addUserToOrg(aaron, await andrew.getActorId(), orgID, tempTeamID))
      .to.eventually.be.rejectedWith(Error, 'Not Authorized to assign user to team');

    // Just to be sure, Andrew should still not be able to see the lists.
    await expectNotToBeAbleToSeeListsOfOrg(andrew, orgID);
    await expectNotToBeAbleToSeeList(andrew, listCreatedByKescha);

    await TinyTodo.addUserToOrg(emina, await andrew.getActorId(), orgID, tempTeamID);

    await expectToBeAbleToSeeListsOfOrg(andrew, orgID, 1);
    await expectToBeAbleToSeeList(andrew, listCreatedByKescha);
  });

  it('allows only admins to add other users to the orgs temp team when the admin is not the creator of the org', async () => {
    const [emina, andrew, kescha, aaron] = await Session.getFourSessions();

    const { orgID, tempTeamID } = await setUpOrg({
      admins: [emina, aaron],
      temps: [kescha],
      interns: [],
    });

    const listCreatedByKescha = await TinyTodo.createList(kescha, 'Org list created by Kescha', orgID);

    await expectNotToBeAbleToSeeListsOfOrg(andrew, orgID);
    await expectNotToBeAbleToSeeList(andrew, listCreatedByKescha);

    await expect(TinyTodo.addUserToOrg(kescha, await andrew.getActorId(), orgID, tempTeamID))
      .to.eventually.be.rejectedWith(Error, 'Not Authorized to assign user to team');

    await expect(TinyTodo.addUserToOrg(andrew, await andrew.getActorId(), orgID, tempTeamID))
      .to.eventually.be.rejectedWith(Error, 'Not Authorized to assign user to team');

    // Just to be sure, Andrew should still not be able to see the lists.
    await expectNotToBeAbleToSeeListsOfOrg(andrew, orgID);
    await expectNotToBeAbleToSeeList(andrew, listCreatedByKescha);

    await TinyTodo.addUserToOrg(aaron, await andrew.getActorId(), orgID, tempTeamID);

    await expectToBeAbleToSeeListsOfOrg(andrew, orgID, 1);
    await expectToBeAbleToSeeList(andrew, listCreatedByKescha);
  });

  it('allows only admin users to add other users to the admin group', async () => {
    const [emina, andrew, kescha, aaron] = await Session.getFourSessions();

    const { orgID, adminTeamID, tempTeamID } = await setUpOrg({
      admins: [emina, aaron],
      temps: [],
      interns: [],
    });

    await TinyTodo.createList(aaron, 'Org list created by Aaron', orgID);

    await expectNotToBeAbleToSeeListsOfOrg(andrew, orgID);
    await expectNotToBeAbleToSeeListsOfOrg(kescha, orgID);

    await TinyTodo.addUserToOrg(aaron, await andrew.getActorId(), orgID, adminTeamID);
    await TinyTodo.addUserToOrg(andrew, await kescha.getActorId(), orgID, tempTeamID);

    await expectToBeAbleToSeeListsOfOrg(aaron, orgID, 1);
    await expectToBeAbleToSeeListsOfOrg(kescha, orgID, 1);
  });

  it('allows only admins delete a list of an organization (even if the user created the list and assigned it to the org then)', async () => {
    const [emina, andrew, kescha, aaron] = await Session.getFourSessions();

    const { orgID } = await setUpOrg({
      admins: [emina, andrew],
      temps: [kescha],
      interns: [aaron],
    });

    const listID = await TinyTodo.createList(kescha, 'Org list created by Aaron', orgID);

    await expectToBeAbleToSeeListsOfOrg(kescha, orgID, 1);

    await expect(TinyTodo.deleteList(kescha, orgID, listID))
      .to.eventually.be.rejectedWith(Error, 'not allowed to delete list');

    await expectToBeAbleToSeeListsOfOrg(kescha, orgID, 1);

    await TinyTodo.deleteList(andrew, orgID, listID);

    await expectToBeAbleToSeeListsOfOrg(kescha, orgID, 0);
  });

  it('does not allow interns to add an list to the organization', async () => {
    const [emina, andrew, kescha, aaron] = await Session.getFourSessions();

    const { orgID } = await setUpOrg({
      admins: [emina, andrew],
      temps: [kescha],
      interns: [aaron],
    });

    await expect(TinyTodo.createList(aaron, 'Aarons List', orgID))
      .to.eventually.be.rejectedWith(Error, 'list not created');
  });

  it('allows interns of an app to modify existing lists', async () => {
    const [emina, andrew, kescha, aaron] = await Session.getFourSessions();

    const { orgID } = await setUpOrg({
      admins: [emina, andrew],
      temps: [kescha],
      interns: [aaron],
    });

    const listID = await TinyTodo.createList(andrew, 'List', orgID);

    await TinyTodo.createTask(aaron, listID, 'Task created the Intern');
  });
});
