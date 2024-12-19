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
        ['$it', '$canRead', '{{todoLists}}'], // user of this group can read the list of lists and nodes which are members of it (the actual lists are the members)
        ['$it', '$canReferTo', '{{todoLists}}'], //  ... can assign a todo list to this org (['$it', '$isMemberOf', todoLists.id!],)
        ['$it', '$canRefine', '{{todoLists}}'], //   ... can assign the archived state to a list ([listId, 'stateIs', archivedState.id])
        ['$it', '$canRefine', '{{org}}'], //         ... can transfer accountability of something to the org
        ['$it', '$canRead', '{{org}}'], //           ... can read the payload of the org
        ['$it', '$isHostOf', '{{tempTeam}}'], //     ... can add other users to the tempTeam
        ['$it', '$isHostOf', '{{internTeam}}'], //   ... can add other users to the internTeam
        ['$it', '$isHostOf', '$it'], //              ... can add other users to this team (adminTeam)
        ['$it', '$canRead', '{{archivedState}}'], // ... can see archivedState so the attribute id can be used in queries to filter out archived lists
        ['$it', '$canReferTo', '{{archivedState}}'], //  can archive lists ([listId, 'stateIs', archivedState.id])
      ],
    },
    tempTeam: {
      type: 'KeyValueAttribute',
      value: { },
      facts: [
        ['$it', 'isA', 'TempTeam'],
        ['{{org}}', '$isAccountableFor', '$it'],
        ['$it', '$canRead', '{{todoLists}}'],
        ['$it', '$canReferTo', '{{todoLists}}'],
        ['$it', '$canRefine', '{{org}}'],
        ['$it', '$canRead', '{{org}}'],
        ['$it', '$canRead', '{{archivedState}}'],
      ],
    },
    internTeam: {
      type: 'KeyValueAttribute',
      value: { },
      facts: [
        ['$it', 'isA', 'InternTeam'],
        ['{{org}}', '$isAccountableFor', '$it'],
        ['$it', '$canAccess', '{{todoLists}}'],
        ['$it', '$canRead', '{{org}}'],
        ['$it', '$canRead', '{{archivedState}}'],
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

  public static async addUserToOrg(client: InitializedSession, otherUserID, orgId, teamId) {
    const fCreated = await client.Fact.createAll([
      [otherUserID, '$isMemberOf', teamId],
    ]);

    if (!fCreated.length) {
      throw new Error('Not Authorized to assign user to team');
    }
  }

  public static async loadOrgAttributes(client: InitializedSession, orgID: string) {
    const { todoLists, archivedState } = await client.Attribute.findAll({
      todoLists: [
        ['$it', 'isA', 'ListOfTodoLists'],
        [orgID, '$isAccountableFor', '$it'],
      ],
      archivedState: [
        ['$it', 'isA', 'ArchivedState'],
        [orgID, '$isAccountableFor', '$it'],
      ],
    });

    if (!todoLists[0]) {
      throw new Error('list of list not found');
    }

    if (!archivedState[0]) {
      throw new Error('archived state not found');
    }

    return {
      todoLists: todoLists[0],
      archivedState: archivedState[0],
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
    }).catch(() => ({ list: undefined }));

    if (!list || !list.id) {
      throw new Error('list not created');
    }

    return list.id;
  }

  public static async getLists(client: InitializedSession, orgID?: string) {
    let orgFilters: [string, string, string][] = [];

    if (orgID) {
      const { todoLists, archivedState } = await this.loadOrgAttributes(client, orgID);

      orgFilters = [
        ['$it', '$isMemberOf', todoLists.id!],
        ['$it', '$latest(stateIs)', `$not(${archivedState.id})`],
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

  public static async deleteList(client: InitializedSession, orgID: string, listId: string) {
    const { archivedState } = await this.loadOrgAttributes(client, orgID);

    const createdFacts = await client.Fact.createAll([
      [listId, 'stateIs', archivedState.id],
    ]);

    if (!createdFacts.length) {
      throw new Error('not allowed to delete list');
    }
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
