// helper functions to make the test cases in tinytodo.spec.ts more readable

/* eslint-disable import/prefer-default-export */
/* eslint-disable @typescript-eslint/no-unused-expressions */
import { expect } from 'chai';
import TinyTodo from './tinytodo';
import { InitializedSession } from '../helpers/session';

function clearCache(client: InitializedSession) {
  return client.do((lr: any) => {
    // eslint-disable-next-line no-param-reassign
    lr.Attribute.attributeCache = {};
  });
}

export async function expectToBeAbleToSeeList(client, listID: string) {
  await clearCache(client);

  const lists = await TinyTodo.getLists(client);
  const list = lists.find((l) => l.id === listID);
  let listData = await list?.getValue();

  expect(list).not.to.eql(undefined);
  expect(typeof listData?.name).to.equal('string');

  listData = await TinyTodo.getList(client, listID);
  expect(typeof listData?.name).to.equal('string');
}

export async function expectNotToBeAbleToSeeList(client, listID: string) {
  await clearCache(client);

  const lists = await TinyTodo.getLists(client);
  const list = lists.find((l) => l.id === listID);

  expect(list).to.eql(undefined);

  await expect(TinyTodo.getList(client, listID))
    .to.eventually.be.rejectedWith(Error, 'list not found');

  // it should also not be possible to change the list
  await expect(TinyTodo.createTask(client, listID, 'unauthorized task'))
    .to.eventually.be.rejectedWith(Error, 'list not found');

  await expect(TinyTodo.toggleTask(client, listID, 'someTaskId'))
    .to.eventually.be.rejectedWith(Error, 'list not found');
}

export async function expectNotToBeAbleToSeeListsOfOrg(client, orgID: string) {
  await clearCache(client);

  await expect(TinyTodo.getLists(client, orgID))
    .to.eventually.be.rejectedWith(Error, 'list of list not found');
}

export async function expectToBeAbleToSeeListsOfOrg(client, orgID: string, listCount: number) {
  await clearCache(client);

  const lists = await TinyTodo.getLists(client, orgID);

  expect(lists.length).to.eql(listCount);
}

export async function expectNotToBeAbleToChangeList(
  client: InitializedSession,
  listID: string,
  otherUser: InitializedSession,
) {
  await clearCache(client);

  const otherUserId = await otherUser.getActorId();

  await expect(TinyTodo.createTask(client, listID, 'unauthorized task'))
    .to.eventually.be.rejectedWith(Error, 'not allowed to change list');

  await expect(TinyTodo.shareList(client, listID, otherUserId, true))
    .to.eventually.be.rejectedWith(Error, 'not allowed to share list');
}

export async function expectToBeAbleToSeeTask(
  client: InitializedSession,
  listID: string,
  taskName: string,
) {
  await clearCache(client);

  const list = await TinyTodo.getList(client, listID);
  const task: any = Object.values(list.tasks).find((t: any) => t.name === taskName);
  expect(task.name).to.equal(taskName);
}
