import 'dotenv/config';
import https from 'https';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import serverSentEvents from '../../lib/server-side-events/server';
import attributeMiddleware from './middleware/attribute';
import factMiddleware from './middleware/fact';
import Fact from '../facts/server';
import factsController from './controllers/facts_controller';
import attributesController from './controllers/attributes_controller';
import authentication from './middleware/authentication';

const blobUpload = multer().single('change');

Fact.initDB();

async function withAuthForEachFact(req, res, controllerAction, isAuthorized) {
  if (process.env['DISABLE_AUTH'] === 'true') {
    console.error('AUTHENTICATION IS DISABLED!!!!');
    controllerAction(req, res, () => true);
    return;
  }

  if (!req?.oidc?.user?.sub) {
    res.status(401).write('Not Authorized');
  } else {
    if (!req.signedCookies.userId) {
      res.cookie('userId', req.oidc.user.sub, { signed: true, httpOnly: false, domain: (new URL(process.env['APP_BASE_URL'] || '')).hostname });
    }

    const isAuthorizedToReadFact = (fact) => isAuthorized(req.oidc.user.sub.replaceAll('|', '-'), req, fact);

    controllerAction(req, res, isAuthorizedToReadFact);
  }
}

async function withAuth(req, res, controllerAction, isAuthorized) {
  const uploadWrappedControllerAction = (request, response) => {
    blobUpload(request, response, (err) => {
      if (err) {
        console.error(`error uploading file for ${req.method} ${req.path}`, err);
      }

      if (request?.file?.fieldname === 'change' && request.body) {
        if (request.method === 'POST') {
          request.body.value = new Blob([request.file.buffer], { type: request.file.mimetype });
        } else {
          request.body.change = {
            value: new Blob([request.file.buffer], { type: request.file.mimetype }),
          };
        }
      }

      controllerAction(request, response);
    });
  };

  if (process.env['DISABLE_AUTH'] === 'true') {
    console.error('AUTHENTICATION IS DISABLED!!!!');
    uploadWrappedControllerAction(req, res);
    return;
  }

  if (!req?.oidc?.user?.sub || !(await isAuthorized(req.oidc.user.sub.replaceAll('|', '-'), req))) {
    res.status(401).write('Not Authorized');
  } else {
    if (!req.signedCookies.userId) {
      res.cookie('userId', req.oidc.user.sub, { signed: true, httpOnly: false, domain: (new URL(process.env['APP_BASE_URL'] || '')).hostname });
    }

    uploadWrappedControllerAction(req, res);
  }
}

function createApp({
  isAuthorizedToCreateAttribute = () => false,
  isAuthorizedToReadAttribute = () => false,
  isAuthorizedToUpdateAttribute = () => false,
  isAuthorizedToCreateFact = () => false,
  isAuthorizedToReadFact = () => false,
  isAuthorizedToUpdateFact = () => false,
  staticMounts = [],
}: {
  isAuthorizedToCreateAttribute?: (userid: string, request: any) => boolean,
  isAuthorizedToReadAttribute?: (userid: string, request: any) => boolean,
  isAuthorizedToUpdateAttribute?: (userid: string, request: any) => boolean,
  isAuthorizedToCreateFact?: (userid: string, request: any) => boolean,
  isAuthorizedToReadFact?: (userid: string, request: any, fact: any) => boolean,
  isAuthorizedToUpdateFact?: (userid: string, request: any) => boolean,
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
  app.use('/', factMiddleware());

  app.post('/attributes/:attributeId', (req, res) => withAuth(req, res, attributesController.create, isAuthorizedToCreateAttribute));
  app.get('/attributes/:id', (req, res) => withAuth(req, res, attributesController.get, isAuthorizedToReadAttribute));
  app.get('/attributes/:attributeId/changes', (req, res) => withAuth(req, res, attributesController.subsribe, isAuthorizedToReadAttribute));
  app.patch('/attributes/:attributeId', (req, res) => withAuth(req, res, attributesController.update, isAuthorizedToUpdateAttribute));
  app.get('/facts', (req, res) => withAuthForEachFact(req, res, factsController.index, isAuthorizedToReadFact));
  app.post('/facts', (req, res) => withAuth(req, res, factsController.create, isAuthorizedToCreateFact));
  app.delete('/facts', (req, res) => withAuth(req, res, factsController.deleteAll, isAuthorizedToUpdateFact));

  app.get('/userinfo', (req, res) => {
    if (!req?.oidc?.user?.sub) {
      res.status(401).send('Not Authorized');
    } else {
      res.cookie('userId', req.oidc.user.sub, { signed: true, httpOnly: false, domain: (new URL(process.env['APP_BASE_URL'] || '')).hostname });
      res.status(200).send('Empty Response');
    }
  });

  return app;
}

export default function createServer(auth, options?, transportDriver:any = https) {
  return transportDriver.createServer(options, createApp(auth));
}
