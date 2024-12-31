/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */
/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import Session from '../helpers/session';

chai.use(chaiAsPromised);

const chunk = function (array, n) {
  if (!array.length) {
    return [];
  }
  return [array.slice(0, n)].concat(chunk(array.slice(n), n));
};

const hour = 60 * 60 * 1000;

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

async function printAverageTime(label, totalFn) {
  const timings: { runtime: number, factCount: number }[] = [];
  const timeIt = async (fn: () => void) => {
    const factCount = await Session.getFactCount();
    const startTime = new Date().getTime();
    await fn();
    const endTime = new Date().getTime();

    timings.push({
      runtime: endTime - startTime,
      factCount,
    });
  };

  await totalFn(timeIt);

  const chunkCount = 20;
  const chunkedTimings = chunk(timings, Math.floor(timings.length / chunkCount) || 1);

  const chunkedAverages = chunkedTimings.map((chunkedTiming) => {
    const runtimeSum = chunkedTiming.reduce((a, b) => a + b.runtime, 0);
    const factCountSum = chunkedTiming.reduce((a, b) => a + b.factCount, 0);
    return {
      runtime: Math.round(runtimeSum / chunkedTiming.length),
      factCount: factCountSum / chunkedTiming.length,
    };
  });

  console.log(`timings ${label}`, chunkedAverages);

  const avg = chunkedAverages.reduce((a, b) => a + b.runtime, 0) / chunkedAverages.length;

  return avg;
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

    const [user1, user2, user3] = await Session.getThreeSessions();

    await ensureTerminologyIsDefined(user1);

    const avgCreationTime = await printAverageTime('create document', async (timeIt) => {
      for (let index = 0; index < 40; index++) {
        await timeIt(() => createDocument(user1));

        if (index % 200 === 0) {
          await timeIt(() => createDocument(user2));
        }

        if (index % 1000 === 0) {
          await timeIt(() => createDocument(user3));
        }
      }
    });

    const avgFindTime = await printAverageTime('find document user3', async (timeIt) => {
      for (let index = 0; index < 10; index++) {
        await timeIt(() => fetchDocuments(user3));
      }
    });

    expect(avgCreationTime).to.be.below(400);
    expect(avgFindTime).to.be.below(50);
  });
});
