import http from 'http';
import createServer from '../../src/server/routes';
import { getPool } from '../../lib/pg-log';

createServer({ transportDriver: http }).then((server) => {
  server.listen(process.env['PORT'] || 3000, 'localhost');
});

// TODO: this is only needed for the browser test.
http.createServer(async (req, res) => {
  if (req.url === '/deleteFacts') {
    if (process.env['NO_DB_TRUNCATE_ON_TEST'] !== 'true') {
      await (await getPool()).query('TRUNCATE facts;');
      await (await getPool()).query('TRUNCATE users_fact_boxes;');
      await (await getPool()).query('TRUNCATE quota_events;');
      console.log('TRUNCATE facts done');
    }
  } else if (req.url === '/getFactCount') {
    const result = await (await getPool()).query('SELECT count(*) as count FROM facts;');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ count: parseInt(result.rows[0].count, 10) }));
    return;
  } else if (req.url === '/insertQuotaEvent') {
    const chunks: Buffer[] = [];

    // eslint-disable-next-line no-restricted-syntax
    for await (const chunk of req) chunks.push(chunk);

    const {
      nodeId,
      totalStorageAvailable,
      validFrom,
    } = JSON.parse(Buffer.concat(chunks).toString());

    await (await getPool()).query(
      'INSERT INTO quota_events (node_id, total_storage_available, valid_from) VALUES ($1, $2, $3)',
      [nodeId, totalStorageAvailable, validFrom],
    );
    res.writeHead(200);
    res.end('ok');
    return;
  } else if (req.url?.startsWith('/queryFacts?')) {
    const params = new URLSearchParams(req.url.slice('/queryFacts?'.length));
    const [subject, predicate, object] = [params.get('subject'), params.get('predicate'), params.get('object')];
    const result = await (await getPool()).query(
      'SELECT * FROM facts WHERE subject=$1 AND predicate=$2 AND object=$3',
      [subject, predicate, object],
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ count: result.rows.length }));
    return;
  }

  res.writeHead(200);
  res.end('ok');
}).listen(3001, 'localhost');

process.on('uncaughtException', (err) => {
  console.error('Unhandled Exception:', err);

  if (err.message.match(/address already in use/)) {
    process.exit(1);
  }
});
