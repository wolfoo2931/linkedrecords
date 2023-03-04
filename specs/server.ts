import http from 'http';
import createServer from '../src/server';

createServer({}, http).listen(process.env['PORT'] || 3000);
