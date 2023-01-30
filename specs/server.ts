import { Server } from 'http';
import createApp from '../src/server';

const port = process.env['PORT'] || 3000;

const app = createApp({
  isAuthorizedToCreateAttribute: () => true,
  isAuthorizedToReadAttribute: () => true,
  isAuthorizedToUpdateAttribute: () => true,
  isAuthorizedToCreateFact: () => true,
  isAuthorizedToReadFact: () => true,
  isAuthorizedToUpdateFact: () => true,
});

const server = new Server(app);
console.log('start server on', port);
server.listen(port);
