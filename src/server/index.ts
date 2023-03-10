import https from 'https';
import http from 'http';
import createServer from './routes';

const port = process.env['PORT'] || 6543;

if (process.env['HTTPS'] === 'true') {
  if (!process.env['SSL_KEY'] || !process.env['SSL_CRT']) {
    throw Error('You must provide a valid value for SSL_KEY and SSL_CRT if HTTPS is set to true');
  }

  createServer({
    transportDriver: https,
    key: process.env['SSL_KEY'].replace(/\\n/g, '\n'),
    cert: process.env['SSL_CRT'].replace(/\\n/g, '\n'),
  }).listen(port);
} else {
  createServer({
    transportDriver: http,
  }).listen(port);
}

console.log(`LinkedRecords is running on port ${port}`);
