import pg from 'pg';

const pgPool = new pg.Pool({ max: 2 });

function unique(arr) {
  var a = [];
  for (var i=0, l=arr.length; i<l; i++)
      if (a.indexOf(arr[i]) === -1 && arr[i] !== '')
          a.push(arr[i]);
  return a;
}

async function getAllUsersIds() {
  const rows = await pgPool.query('SELECT id FROM users');

  return rows.rows.map((r) => r.id.trim());
}

async function getNodesByUserId(id) {
  const rows = await pgPool.query(`
    WITH user_facts AS (SELECT * FROM public.facts WHERE fact_box_id=0 AND predicate != '$isATermFor' AND created_by='${id}' AND object NOT IN (SELECT subject FROM facts where predicate='$isATermFor'))
    SELECT subject as node FROM user_facts UNION SELECT object as node FROM user_facts
  `);

  return rows.rows.map((r) => r.node.trim());
}

async function getAllUsersConnectTo(nodes) {
  const result =  await pgPool.query(`WITH
    user_facts AS (
      SELECT * FROM public.facts
      WHERE fact_box_id=0
      AND predicate != '$isATermFor'
      AND (subject IN (${nodes.map((n) => `'${n.trim()}'`).join(',')}) OR object IN (${nodes.map((n) => `'${n.trim()}'`).join(',')}))
      AND object NOT IN (SELECT subject FROM facts where predicate='$isATermFor'))
    SELECT DISTINCT subject as node FROM user_facts WHERE subject LIKE 'us-%' UNION SELECT DISTINCT object as node FROM user_facts WHERE object LIKE 'us-%'
  `);

  return result.rows.map((r) => r.node.trim());
}

async function getConnectedNodes(nodeId) {
  let connectedNodes = [nodeId];
  let lastNodeCount = 0;

  while (connectedNodes.length !== lastNodeCount) {
    lastNodeCount = connectedNodes.length;

    const newNodes = await pgPool.query(`WITH
      user_facts AS (
        SELECT * FROM public.facts
        WHERE fact_box_id=0
        AND predicate != '$isATermFor'
        AND (subject IN (${connectedNodes.map((n) => `'${n.trim()}'`).join(',')}) OR object IN (${connectedNodes.map((n) => `'${n.trim()}'`).join(',')}))
        AND object NOT IN (SELECT subject FROM facts where predicate='$isATermFor')
        AND subject NOT IN (SELECT subject FROM facts where predicate='$isATermFor'))
      SELECT DISTINCT subject as node FROM user_facts WHERE subject NOT LIKE 'us-%' UNION SELECT DISTINCT object as node FROM user_facts WHERE object NOT LIKE 'us-%'
    `);

    connectedNodes = unique([
      ...connectedNodes,
      ...newNodes.rows.map((r) => r.node.trim())
    ]);
  }

  return connectedNodes;
}

async function getNewFactBoxId(l) {
  const newFactBoxIdResult = await pgPool.query("SELECT nextval('users__id_seq') as id");

  return newFactBoxIdResult.rows[0].id;
}

async function getNewGraphId() {
  const newFactBoxIdResult = await pgPool.query("SELECT nextval('graph_id') as id");

  return newFactBoxIdResult.rows[0].id;
}


async function getInternalUserId(userid) {
  const result = await pgPool.query('SELECT _id as internal_user_id FROM users WHERE id=$1', [userid]);

  if(!result.rows.length) {
    return;
  }

  return result.rows[0].internal_user_id;
}

async function moveToFactBox(nodes, users) {
  const factBoxId = await getNewFactBoxId();
  const nodeSet = nodes.map(n => `'${n.trim()}'`).join(',');

  console.log('create New Fact box', factBoxId)

  await pgPool.query(`UPDATE facts SET fact_box_id='${factBoxId}', graph_id=NULL WHERE object IN (${nodeSet}) OR subject IN (${nodeSet})`);

  await Promise.all(users.map(async (id) => {
    const internalId = await getInternalUserId(id);
    if(internalId) {
      await pgPool.query('INSERT INTO users_fact_boxes (fact_box_id, user_id) VALUES ($1, $2)', [factBoxId, internalId]);
    }
  }));
}

async function addUserScope(nodes, user) {
  const nodeSet = nodes.map(n => `'${n.trim()}'`).join(',');
  const internalUserId = await getInternalUserId(user);
  const graphId = await getNewGraphId();

  await pgPool.query(`UPDATE facts SET fact_box_id='${internalUserId}', graph_id='${graphId}' WHERE object IN (${nodeSet}) OR subject IN (${nodeSet})`);
}

async function deactivateFactsFromUnknownUsers() {
  await pgPool.query(`UPDATE facts SET fact_box_id=-1
  WHERE fact_box_id=0
  AND predicate != '$isATermFor'
  AND created_BY NOT IN (SELECT id FROM users)`);

  await pgPool.query(`UPDATE facts SET fact_box_id=-1
    WHERE fact_box_id=0
    AND (subject LIKE 'l-%' OR subject LIKE 'kv-%' OR subject LIKE 'bl-%' or object LIKE 'l-%' OR object LIKE 'kv-%' OR object LIKE 'bl-%')
  `);
}

async function main() {
  const users = await getAllUsersIds();

  for (let index = 0; index < users.length; index++) {
    const user = users[index];
    let openNodes = await getNodesByUserId(user);

    while(openNodes.length) {
      const node = openNodes[0];
      const graph = await getConnectedNodes(node);
      const users = await getAllUsersConnectTo(graph);

      if(users.length === 1 && users[0] === user) {
        console.log('move to fact box', graph.length, users);
        await addUserScope(graph, user)
      } else {
        console.log('move to fact box', graph.length, users);
        await moveToFactBox(graph, users)
      }

      openNodes = await getNodesByUserId(user);
    }
  }

  await deactivateFactsFromUnknownUsers();

  console.log('done');
}

await main();


