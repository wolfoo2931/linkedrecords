import pg from 'pg';
import http from 'http';
import createServer from '../../src/server/routes';

const pgPool = new pg.Pool({ max: 2 });

createServer({ transportDriver: http }).then((server) => {
  server.listen(process.env['PORT'] || 3000);
});

http.createServer(async (req, res) => {
  if (req.url === '/deleteFacts') {
    await pgPool.query('TRUNCATE facts;');
    console.log('TRUNCATE facts done');
  }

  res.writeHead(200);
  res.end('ok');
}).listen(3001);
