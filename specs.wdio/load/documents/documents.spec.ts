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
import { remote } from 'webdriverio';
import Session from '../../helpers/session';
import Timer from '../../helpers/timer';

chai.use(chaiAsPromised);

const hour = 60 * 60 * 1000;
const pgPool = new pg.Pool({ max: 2 });

function getRandomElements(arr, n) {
  const result: any[] = [];
  const { length } = arr;

  for (let i = 0; i < n; i++) {
    const randomIndex = Math.floor(Math.random() * length);
    result.push(arr[randomIndex]);
  }

  return result;
}

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

async function fetchDocuments(client, teamId?) {
  const userId = await client.getActorId();
  const accountee = teamId || userId;

  const { documents } = await client.Attribute.findAll({
    documents: [
      ['$it', '$hasDataType', 'KeyValueAttribute'],
      ['$it', 'isA', 'documentConfig'],
      ['$it', '$latest(deletionStateIs)', '$not(inTrashbin)'],
      ['$it', '$latest(deletionStateIs)', '$not(deleted)'],
      [accountee, '$isAccountableFor', '$it'],
    ],
  });

  return documents;
}

async function fetchDocument(client, contentId) {
  const userId = await client.getActorId();

  return client.Attribute.findAll({
    content: contentId,
    otherUsersComments: [
      ['$hasDataType', 'KeyValueAttribute'],
      ['isA', 'documentCommentCollection'],
      ['belongsTo', contentId],
      [userId, '$isAccountableFor', '$not($it)'],
    ],
    myComments: [
      ['$hasDataType', 'KeyValueAttribute'],
      ['isA', 'documentCommentCollection'],
      ['belongsTo', contentId],
      [userId, '$isAccountableFor', '$it'],
    ],
    documentCollaboratorGroup: [
      ['$hasDataType', 'KeyValueAttribute'],
      ['isDocumentCollaboratorGroupOf', contentId],
    ],
    documentReaderGroup: [
      ['$hasDataType', 'KeyValueAttribute'],
      ['isDocumentReaderGroupOf', contentId],
    ],
    usersActivityAttribute: [
      ['$hasDataType', 'KeyValueAttribute'],
      ['isA', 'userActivityState'],
      ['belongsTo', contentId],
    ],
    references: [
      ['$hasDataType', 'KeyValueAttribute'],
      ['isA', 'referenceStore'],
      ['belongsTo', contentId],
    ],
    referenceSources: [
      ['$hasDataType', 'KeyValueAttribute'],
      ['isA', 'referenceSourceStore'],
      ['belongsTo', contentId],
      ['belongsTo', userId],
    ],
    documentConfig: [
      ['$hasDataType', 'KeyValueAttribute'],
      ['isA', 'documentConfig'],
      ['belongsTo', contentId],
    ],
  });
}

async function createDocument(client, teamId?) {
  const userId = await client.getActorId();
  const accountee = teamId || userId;

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
        [accountee, '$isAccountableFor', '$it'],
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
        [accountee, '$isAccountableFor', '$it'],
      ],
    },
    usersActivityAttribute: {
      type: 'KeyValueAttribute',
      value: {},
      facts: [
        ['isA', 'userActivityState'],
        ['belongsTo', '{{content}}'],
        [accountee, '$isAccountableFor', '$it'],
      ],
    },
    content: {
      type: 'LongTextAttribute',
      value: 'xxx',
      facts: [
        ['isA', 'documentContent'],
        [accountee, '$isAccountableFor', '$it'],
      ],
    },
    myComments: {
      type: 'KeyValueAttribute',
      value: {},
      facts: [
        ['isA', 'documentCommentCollection'],
        ['belongsTo', '{{content}}'],
        [accountee, '$isAccountableFor', '$it'],
      ],
    },
    documentConfig: {
      type: 'KeyValueAttribute',
      value: {},
      facts: [
        ['isA', 'documentConfig'],
        ['belongsTo', '{{content}}'],
        [accountee, '$isAccountableFor', '$it'],
      ],
    },
    references: {
      type: 'KeyValueAttribute',
      value: {},
      facts: [
        ['isA', 'referenceStore'],
        ['belongsTo', '{{content}}'],
        [accountee, '$isAccountableFor', '$it'],
      ],
    },
    referenceSources: {
      type: 'KeyValueAttribute',
      value: {},
      facts: [
        ['isA', 'referenceSourceStore'],
        ['belongsTo', '{{content}}'],
        [userId, '$isAccountableFor', '$it'],
        ['belongsTo', userId],
      ],
    },
  });
}

function addChartDataTo(chartData, file) {
  let fileExists = false;

  try {
    fs.statSync(file);
    fileExists = true;
  } catch (ex) {
    fileExists = false;
  }

  if (!fileExists) {
    return fs.writeFileSync(file, JSON.stringify(chartData));
  }

  const fileContent = fs.readFileSync(file, 'utf8');
  const existing = JSON.parse(fileContent);

  chartData.forEach((record) => {
    const existingRecord = existing.find((x) => x.name === record.name);
    existingRecord.x.push(...record.x);
    existingRecord.y.push(...record.y);
  });

  return fs.writeFileSync(file, JSON.stringify(existing));
}

async function renderChartToImage() {
  const chartHtmlPath = path.join(__dirname, '.chart', 'chart.html');
  const outputPath = path.resolve(__dirname, '../../../.github/assets/load-test-chart.png');

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await remote({
    capabilities: {
      browserName: 'chrome',
      'goog:chromeOptions': {
        args: ['--headless'],
      },
    },
  });

  try {
    // Navigate to the chart HTML file
    await browser.url(`file://${chartHtmlPath}`);

    // Wait for Plotly to render the chart
    await browser.waitUntil(
      async () => {
        const plotExists = await browser.execute(() => {
          const plotDiv = document.getElementById('myDiv');
          // Check if Plotly has rendered (it adds svg elements)
          return plotDiv && plotDiv.querySelector('.plot-container') !== null;
        });
        return plotExists;
      },
      { timeout: 10000, timeoutMsg: 'Chart did not render within 10 seconds' },
    );

    // Small delay to ensure chart is fully rendered
    await browser.pause(500);

    // Take screenshot and save to file
    await browser.saveScreenshot(outputPath);
    console.log(`Chart screenshot saved to: ${outputPath}`);
  } finally {
    await browser.deleteSession();
  }
}

async function getRandomContentIds(client, accountee, n) {
  const { content } = await client.Attribute.findAll({
    content: [
      ['isA', 'documentContent'],
      [accountee, '$isAccountableFor', '$it'],
    ],
  });

  if (!content.length) {
    for (let index = 0; index < n; index++) {
      await createDocument(client, accountee);
    }

    return getRandomContentIds(client, accountee, n);
  }

  return getRandomElements(content, n).map((x) => x.id);
}

describe('Many Documents', function () {
  this.timeout(4 * hour);
  beforeEach(Session.truncateDB);
  afterEach(Session.afterEach);
  after(async function () {
    await Session.deleteBrowsers();
    if (process.env['RUN_LOAD_TEST'] === 'true') {
      console.log('Rendering chart to image...');
      await renderChartToImage();
    }
  });

  it('allows to insert a lot of documents', async function () {
    if (process.env['RUN_LOAD_TEST'] !== 'true') {
      this.skip();
    }

    const [user1, user2, user3] = await Session.getThreeSessions();
    const orgUnderTestId = await user2.getActorId();
    const maxDocumentsForOrgUnderTest = 300;
    const createDocumentForOrgUnderTestEvery = 10;

    const timer = new Timer(async () => {
      const result = await pgPool.query("SELECT count(*) as count FROM facts WHERE predicate='isA' and object='documentContent';");

      return parseInt(result.rows[0].count, 10);
    });

    await ensureTerminologyIsDefined(user1);

    for (let index = 0; index < 1000; index++) {
      await timer.timeIt('createDocument', () => createDocument(user1));

      if (index % createDocumentForOrgUnderTestEvery === 0) {
        const user2docs = await fetchDocuments(user2);
        if (maxDocumentsForOrgUnderTest > user2docs.length) {
          await timer.timeIt('createDocument', () => createDocument(user2));
        } else {
          console.log('............ skip creation of documents for user2');
        }
      }

      if (index % 1000 === 0) {
        await timer.timeIt('createDocument', () => createDocument(user3));
      }

      if (index % 20 === 0) {
        await timer.timeIt('fetchDocuments', () => fetchDocuments(user2, orgUnderTestId));
        await timer.timeIt('fetchDocuments', () => fetchDocuments(user2, orgUnderTestId));
        await timer.timeIt('fetchDocuments', () => fetchDocuments(user2, orgUnderTestId));
        await timer.timeIt('fetchDocuments', () => fetchDocuments(user2, orgUnderTestId));

        const contentIds = await getRandomContentIds(user2, orgUnderTestId, 4);
        await timer.timeIt('fetchDocument', () => fetchDocument(user2, contentIds[0]));
        await timer.timeIt('fetchDocument', () => fetchDocument(user2, contentIds[1]));
        await timer.timeIt('fetchDocument', () => fetchDocument(user2, contentIds[2]));
        await timer.timeIt('fetchDocument', () => fetchDocument(user2, contentIds[3]));
      }
    }

    const chartData = await Promise.all([
      timer.getPlotyTraceForLabel('createDocument'),
      timer.getPlotyTraceForLabel('fetchDocuments'),
      timer.getPlotyTraceForLabel('fetchDocument'),
    ]);

    addChartDataTo(chartData, path.join(__dirname, '.chart', 'acc_chart_data.json'));
    fs.writeFileSync(path.join(__dirname, '.chart', 'chart_data.js'), `var data = ${JSON.stringify(chartData)}`);

    expect(await timer.getAverageRuntimeForLabel('createDocument')).to.be.below(200);
    expect(await timer.getAverageRuntimeForLabel('fetchDocuments')).to.be.below(100);
    expect(await timer.getAverageRuntimeForLabel('fetchDocument')).to.be.below(100);
  });
});
