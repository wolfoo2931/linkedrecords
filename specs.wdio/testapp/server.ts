import pg from 'pg';
import http from 'http';
import createServer from '../../src/server/routes';

const pgPool = new pg.Pool({ max: 2 });

createServer({ transportDriver: http }).then((server) => {
  server.listen(process.env['PORT'] || 3000);
});

// TODO: this is only needed for the karma test, can be removed once all tests are migrated to wdio
http.createServer(async (req, res) => {
  if (req.url === '/deleteFacts') {
    if (process.env['NO_DB_TRUNCATE_ON_TEST'] !== 'true') {
      await pgPool.query('TRUNCATE facts;');
      await pgPool.query('TRUNCATE users_fact_boxes;');
      console.log('TRUNCATE facts done');
    }
  }

  res.writeHead(200);
  res.end('ok');
}).listen(3001);
