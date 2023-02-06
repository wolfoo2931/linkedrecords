import createServer from '../src/server';

const port = process.env['PORT'] || 3000;
const auth = {
  isAuthorizedToCreateAttribute: () => true,
  isAuthorizedToReadAttribute: () => true,
  isAuthorizedToUpdateAttribute: () => true,
  isAuthorizedToCreateFact: () => true,
  isAuthorizedToReadFact: () => true,
  isAuthorizedToUpdateFact: () => true,
};

createServer(auth).listen(port);
