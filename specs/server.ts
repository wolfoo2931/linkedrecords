import { Server } from 'http';
import createApp from '../src/server';

const port = process.env['PORT'] || 3000;

const app = createApp({
  isAuthorizedToCreateAttribute: () => true,
  isAuthorizedToReadAttribute: () => true,
  isAuthorizedToUpdateAttribute: () => true,
  isAuthorizedToCreateFacts: () => true,
  isAuthorizedToReadFacts: () => true,
  isAuthorizedToUpdateFacts: () => true,
});

const server = new Server(app);
console.log('start server on', port);
server.listen(port);
