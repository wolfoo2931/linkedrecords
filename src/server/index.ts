import { Server } from 'http';
import express from 'express';
import createApp from './linkedrecords';

createApp({
  isAuthorizedToCreateAttribute: () => true,
  isAuthorizedToReadAttribute: () => true,
  isAuthorizedToUpdateAttribute: () => true,
  isAuthorizedToCreateFacts: () => true,
  isAuthorizedToReadFacts: () => true,
  isAuthorizedToUpdateFacts: () => true,
}).then((app) => {
  app.use('/example', express.static('example'));

  const server = new Server(app);
  server.listen(process.env['PORT'] || 3000);
});
