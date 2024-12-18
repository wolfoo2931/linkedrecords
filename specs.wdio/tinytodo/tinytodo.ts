import { uuidv4 } from 'uuidv7';
import { CompositionCreationRequest } from '../../src/browser_sdk/attributes_repository';
import { InitializedSession } from '../helpers/session';

function getOrgBlueprint(orgName: string): CompositionCreationRequest {
  return {
    org: {
      type: 'KeyValueAttribute',
      value: { name: orgName },
      facts: [
        ['$it', 'isA', 'Organization'],
      ],
    },
    todoLists: {
      type: 'KeyValueAttribute', // we do not have a BlankNode implementation yet.
      value: { },
      facts: [
        ['$it', 'isA', 'ListOfTodoLists'],
        ['{{org}}', '$isAccountableFor', '$it'],
      ],
    },
    archivedState: {
      type: 'KeyValueAttribute',
      value: { },
      facts: [
        ['$it', 'isA', 'ArchivedState'],
        ['{{org}}', '$isAccountableFor', '$it'],
      ],
    },
    adminTeam: {
      type: 'KeyValueAttribute',
      value: { },
      facts: [
        ['$it', 'isA', 'AdminTeam'],
        ['{{org}}', '$isAccountableFor', '$it'],
        ['$it', '$isMemberOf', '{{org}}'],
        ['$it', '$canReferTo', '{{archivedState}}'],
        ['$it', '$canReferTo', '{{todoLists}}'],
        ['$it', '$canAccess', '{{todoLists}}'],
        ['$it', '$isHostOf', '{{tempTeam}}'],
        ['$it', '$isHostOf', '{{internTeam}}'],
      ],
    },
    tempTeam: {
      type: 'KeyValueAttribute',
      value: { },
      facts: [
        ['$it', 'isA', 'TempTeam'],
        ['{{org}}', '$isAccountableFor', '$it'],
        ['$it', '$canRefine', '{{org}}'],
        ['$it', '$canAccess', '{{todoLists}}'],
        ['$it', '$canReferTo', '{{todoLists}}'],
      ],
    },
    internTeam: {
      type: 'KeyValueAttribute',
      value: { },
      facts: [
        ['$it', 'isA', 'InternTeam'],
        ['{{org}}', '$isAccountableFor', '$it'],
        ['$it', '$canAccess', '{{todoLists}}'],
      ],
    },
  };
}

export default class TinyTodo {
  public static async ensureTerminologyIsDefined(client: InitializedSession) {
    return client.Fact.createAll([
      ['Organization', '$isATermFor', 'xx'],
      ['TodoList', '$isATermFor', 'xx'],
      ['ListOfTodoLists', '$isATermFor', 'xx'],
      ['ArchivedState', '$isATermFor', 'xx'],
      ['AdminTeam', '$isATermFor', 'xx'],
      ['TempTeam', '$isATermFor', 'xx'],
      ['InternTeam', '$isATermFor', 'xx'],
    ]);
  }

  public static async createOrg(client: InitializedSession, orgName: string) {
    return client.Attribute.createAll(getOrgBlueprint(orgName));
  }

  public static async loadOrgAttributes(client: InitializedSession, orgID: string) {
    const { archState, todoLists } = await client.Attribute.findAll({
      archState: [
        ['$it', 'isA', 'ArchivedState'],
        [orgID, '$isAccountableFor', '$it'],
      ],
      todoLists: [
        ['$it', 'isA', 'ListOfTodoLists'],
        [orgID, '$isAccountableFor', '$it'],
      ],
    });

    if (!archState[0] || !todoLists[0]) {
      throw new Error('org not found');
    }

    return {
      archState: archState[0],
      todoLists: todoLists[0],
    };
  }

  public static async createList(
    client: InitializedSession,
    listName: string,
    orgID?: string,
  ): Promise<string> {
    let orgRelatedFacts: [string, string, string][] = [];

    if (orgID) {
      const { todoLists } = await this.loadOrgAttributes(client, orgID);
      orgRelatedFacts = [
        ['$it', '$isMemberOf', todoLists.id!],
        [orgID, '$isAccountableFor', '$it'],
      ];
    }

    const { list } = await client.Attribute.createAll({
      list: {
        type: 'KeyValueAttribute',
        value: {
          name: listName,
          tasks: {},
        },
        facts: [
          ...orgRelatedFacts,
          ['$it', 'isA', 'TodoList'],
        ],
      },
    });

    if (!list.id) {
      throw new Error('List not created');
    }

    return list.id;
  }

  public static async getLists(client: InitializedSession, orgID?: string) {
    let orgFilters: [string, string, string][] = [];

    if (orgID) {
      const { archState, todoLists } = await this.loadOrgAttributes(client, orgID);

      orgFilters = [
        ['$it', '$isMemberOf', todoLists.id!],
        ['$it', 'latest(stateIs)', `$not(${archState.id})`],
      ];
    }

    return client.Attribute.findAll({
      lists: [
        ['$it', 'isA', 'TodoList'],
        ...orgFilters,
      ],
    }).then((r) => r.lists);
  }

  public static async getList(client: InitializedSession, listId: string) {
    const list = await client.Attribute.find(listId);

    if (!list) {
      throw new Error('list not found');
    }

    return list.getValue();
  }

  public static async deleteList(client: InitializedSession, listId: string, orgID: string) {
    const { archState } = await this.loadOrgAttributes(client, orgID);

    return client.Fact.createAll([
      [listId, 'latest(stateIs)', archState.id],
    ]);
  }

  public static async shareList(
    client: InitializedSession,
    listId: string,
    shareWith: string,
    readOnly: boolean,
  ) {
    const factsCreated = await client.Fact.createAll([
      [shareWith, readOnly ? '$canRead' : '$canAccess', listId],
    ]);

    if (!factsCreated.length) {
      throw new Error('not allowed to share list');
    }
  }

  public static async unshareList(
    client: InitializedSession,
    listId: string,
    unshareWith: string,
    readOnly: boolean,
  ) {
    return client.Fact.deleteAll([
      [unshareWith, readOnly ? '$canRead' : '$canAccess', listId],
    ]);
  }

  public static async createTask(client: InitializedSession, listID: string, name: string) {
    await this.setTaskField(client, listID, uuidv4(), '', { name, done: false });
  }

  public static async toggleTask(client: InitializedSession, listID: string, taskID: string) {
    const list = await this.getList(client, listID);
    const listData = await list.getValue();

    await this.setTaskField(client, listID, taskID, '.done', !listData?.tasks[taskID]?.done);
  }

  public static async findTask(client: InitializedSession, listID: string, taskID: string) {
    const list = await this.getList(client, listID);
    const listData = await list.getValue();
    return listData?.tasks[taskID];
  }

  public static async changeTaskDescription(
    client: InitializedSession,
    listID: string,
    taskID: string,
    description: string,
  ) {
    await this.setTaskField(client, listID, taskID, '.description', description);
  }

  public static async deleteTask(client: InitializedSession, listID: string, taskID: string) {
    await this.setTaskField(client, listID, taskID, '', null);
  }

  private static async setTaskField(
    client: InitializedSession,
    listID: string,
    taskID: string,
    field: string,
    value: any,
  ) {
    // the WDIO remote method invocation hack does not work here.
    // we have to execute the JS directly in the browser manually
    const result = await client.do(async (c, lID, tID, f, v) => {
      const list = await c.Attribute.find(lID);

      if (!list) {
        throw new Error('list not found');
      }

      const r = await list.change(new c.KeyValueChange([
        {
          key: `tasks.${tID}${f}`,
          value: v,
        },
      ]));

      return r;
    }, listID, taskID, field, value);

    if (!result) {
      throw new Error('not allowed to change list');
    }

    await browser.pause(1000);
  }
}
