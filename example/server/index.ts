import { Server } from 'http';
import express from 'express';
import createApp from '../../src/server';

createApp({
  isAuthorizedToCreateAttribute: () => true,
  isAuthorizedToReadAttribute: () => true,
  isAuthorizedToUpdateAttribute: () => true,
  isAuthorizedToCreateFacts: () => true,
  isAuthorizedToReadFacts: () => true,
  isAuthorizedToUpdateFacts: () => true,
}).then((app) => {
  app.use('/example', express.static('example/client'));

  const server = new Server(app);
  server.listen(process.env['PORT'] || 3000);
});
