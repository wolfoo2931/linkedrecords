/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
import fs from 'fs';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import path from 'path';
import pg from 'pg';
import Session from '../../helpers/session';
import Timer from '../../helpers/timer';

chai.use(chaiAsPromised);

const hour = 60 * 60 * 1000;
const pgPool = new pg.Pool({ max: 2 });

async function ensureTerminologyIsDefined(client) {
  return client.Fact.createAll([
    ['userActivityState', '$isATermFor', 'xx'],
    ['documentContent', '$isATermFor', 'xx'],
    ['documentCommentCollection', '$isATermFor', 'xx'],
    ['documentConfig', '$isATermFor', 'xx'],
    ['referenceStore', '$isATermFor', 'xx'],
    ['referenceSourceStore', '$isATermFor', 'xx'],
  ]);
}

async function fetchDocuments(client) {
  const userId = await client.getActorId();

  await client.Attribute.findAll({
    documents: [
      ['$it', '$hasDataType', 'KeyValueAttribute'],
      ['$it', 'isA', 'documentConfig'],
      ['$it', '$latest(deletionStateIs)', '$not(inTrashbin)'],
      ['$it', '$latest(deletionStateIs)', '$not(deleted)'],
      [userId, '$isAccountableFor', '$it'],
    ],
  });
}

async function createDocument(client) {
  const userId = await client.getActorId();
  await client.Attribute.createAll({
    documentCollaboratorGroup: {
      type: 'KeyValueAttribute',
      value: {},
      facts: [
        ['isDocumentCollaboratorGroupOf', '{{content}}'],
        ['$canAccess', '{{content}}'],
        ['$canReferTo', '{{content}}'],
        ['$canAccess', '{{documentConfig}}'],
        ['$canAccess', '{{references}}'],
        ['$canAccess', '{{usersActivityAttribute}}'],
      ],
    },
    documentReaderGroup: {
      type: 'KeyValueAttribute',
      value: {},
      facts: [
        ['isDocumentReaderGroupOf', '{{content}}'],
        ['$canReferTo', '{{content}}'],
        ['$canRead', '{{content}}'],
        ['$canRead', '{{documentConfig}}'],
        ['$canRead', '{{references}}'],
        ['$canRead', '{{usersActivityAttribute}}'],
      ],
    },
    usersActivityAttribute: {
      type: 'KeyValueAttribute',
      value: {},
      facts: [
        ['isA', 'userActivityState'],
        ['belongsTo', '{{content}}'],
      ],
    },
    content: {
      type: 'LongTextAttribute',
      value: 'xxx',
      facts: [
        ['isA', 'documentContent'],
      ],
    },
    myComments: {
      type: 'KeyValueAttribute',
      value: {},
      facts: [
        ['isA', 'documentCommentCollection'],
        ['belongsTo', '{{content}}'],
      ],
    },
    documentConfig: {
      type: 'KeyValueAttribute',
      value: {},
      facts: [
        ['isA', 'documentConfig'],
        ['belongsTo', '{{content}}'],
      ],
    },
    references: {
      type: 'KeyValueAttribute',
      value: {},
      facts: [
        ['isA', 'referenceStore'],
        ['belongsTo', '{{content}}'],
      ],
    },
    referenceSources: {
      type: 'KeyValueAttribute',
      value: {},
      facts: [
        ['isA', 'referenceSourceStore'],
        ['belongsTo', '{{content}}'],
        ['belongsTo', userId],
      ],
    },
  });
}

describe('Many Many Document', function () {
  this.timeout(1 * hour);
  beforeEach(Session.truncateDB);
  afterEach(Session.afterEach);
  after(Session.deleteBrowsers);

  it('allows to insert a lot of documents', async function () {
    if (process.env['RUN_LOAD_TEST'] !== 'true') {
      this.skip();
    }

    const timer = new Timer(async () => {
      const result = await pgPool.query("SELECT count(*) as count FROM facts WHERE predicate='isA' and object='documentContent';");

      return parseInt(result.rows[0].count, 10);
    });

    const [user1, user2, user3] = await Session.getThreeSessions();

    await ensureTerminologyIsDefined(user1);

    for (let index = 0; index < 10000; index++) {
      await timer.timeIt('createDocument', () => createDocument(user1));

      if (index % 20 === 0) {
        await timer.timeIt('fetchDocuments', () => fetchDocuments(user2));
        await timer.timeIt('fetchDocuments', () => fetchDocuments(user2));
        await timer.timeIt('fetchDocuments', () => fetchDocuments(user2));
        await timer.timeIt('fetchDocuments', () => fetchDocuments(user2));
      }

      if (index % 200 === 0) {
        await timer.timeIt('createDocument', () => createDocument(user2));
      }

      if (index % 1000 === 0) {
        await timer.timeIt('createDocument', () => createDocument(user3));
      }
    }

    const chartData = await Promise.all([
      timer.getPlotyTraceForLabel('createDocument'),
      timer.getPlotyTraceForLabel('fetchDocuments'),
    ]);

    fs.writeFileSync(path.join(__dirname, '.chart', 'chart_data.js'), `var data = ${JSON.stringify(chartData)}`);

    expect(await timer.getAverageRuntimeForLabel('createDocument')).to.be.below(200);
    expect(await timer.getAverageRuntimeForLabel('fetchDocuments')).to.be.below(100);
  });
});
