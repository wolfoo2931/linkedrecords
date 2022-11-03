import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import morgan from 'morgan';
import serverSentEvents from '../../lib/server-side-events/server';
import attributeMiddleware from './middleware/attribute';
import Fact from '../facts/server';
import factsController from './controllers/facts_controller';
import attributesController from './controllers/attributes_controller';
import authentication from './middleware/authentication';
import 'dotenv/config';

Fact.initDB();

function withAuth(req, res, controllerAction, isAuthorized) {
  if (process.env['DISABLE_AUTH'] === 'true') {
    controllerAction(req, res);
    return;
  }

  if (!req?.oidc?.user?.sub || !isAuthorized(req.oidc.user.sub, req)) {
    res.status(401).write('Not Authorized');
  } else {
    if (!req.signedCookies.userId) {
      res.cookie('userId', req.oidc.user.sub, { signed: true, httpOnly: false });
    }

    controllerAction(req, res);
  }
}

export default function createApp({
  isAuthorizedToCreateAttribute = () => false,
  isAuthorizedToReadAttribute = () => false,
  isAuthorizedToUpdateAttribute = () => false,
  isAuthorizedToCreateFacts = () => false,
  isAuthorizedToReadFacts = () => false,
  isAuthorizedToUpdateFacts = () => false,
  staticMounts = [],
}: {
  isAuthorizedToCreateAttribute?: (userid: string, request: any) => boolean,
  isAuthorizedToReadAttribute?: (userid: string, request: any) => boolean,
  isAuthorizedToUpdateAttribute?: (userid: string, request: any) => boolean,
  isAuthorizedToCreateFacts?: (userid: string, request: any) => boolean,
  isAuthorizedToReadFacts?: (userid: string, request: any) => boolean,
  isAuthorizedToUpdateFacts?: (userid: string, request: any) => boolean,
  staticMounts?: [string, string][]
} = {}) {
  const app = express();

  staticMounts.forEach(([UrlPath, filePath]) => {
    app.use(UrlPath, express.static(filePath));
  });

  app.use(cookieParser(process.env['AUTH_COOKIE_SIGNING_SECRET']));
  app.use(express.json());
  app.use(morgan('tiny', { skip: (req) => req.method === 'OPTIONS' }));

  if (process.env['CORS_ORIGIN']) {
    app.use(cors({
      origin: process.env['CORS_ORIGIN'],
      credentials: true,
    }));
  }

  app.use(authentication());

  app.use(serverSentEvents());
  app.use('/attributes', attributeMiddleware());

  app.post('/attributes/:attributeId', (req, res) => withAuth(req, res, attributesController.create, isAuthorizedToCreateAttribute));
  app.get('/attributes/:id', (req, res) => withAuth(req, res, attributesController.get, isAuthorizedToReadAttribute));
  app.get('/attributes/:attributeId/changes', (req, res) => withAuth(req, res, attributesController.subsribe, isAuthorizedToReadAttribute));
  app.patch('/attributes/:attributeId', (req, res) => withAuth(req, res, attributesController.update, isAuthorizedToUpdateAttribute));
  app.get('/facts', (req, res) => withAuth(req, res, factsController.index, isAuthorizedToReadFacts));
  app.post('/facts', (req, res) => withAuth(req, res, factsController.create, isAuthorizedToCreateFacts));
  app.delete('/facts', (req, res) => withAuth(req, res, factsController.deleteAll, isAuthorizedToUpdateFacts));

  return app;
}
