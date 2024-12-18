import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import Session from '../helpers/session';
import TinyTodo from './tinytodo';
import {
  expectNotToBeAbleToChangeList,
  expectNotToBeAbleToSeeList,
  expectToBeAbleToSeeList,
  expectToBeAbleToSeeTask,
} from './tinytodo_expects';

chai.use(chaiAsPromised);

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
    const orgAttributes = await TinyTodo.createOrg(emina, 'TinyTodo Org');
    const orgID = orgAttributes?.['org']?.id;

    if (!orgID) {
      throw new Error('Org not created');
    }

    // Andrew can not get lists because he is not member of the org
    await expect(TinyTodo.getLists(andrew, orgID))
      .to.eventually.be.rejectedWith(Error, 'org not found');

    // Andrew can not create a list because he is not member of the org
    await expect(TinyTodo.createList(andrew, 'Andrews List', orgID))
      .to.eventually.be.rejectedWith(Error, 'org not found');

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
});
