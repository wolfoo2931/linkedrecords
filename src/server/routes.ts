/* eslint-disable max-len */
import 'dotenv/config';
import https from 'https';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import md5 from 'md5';
import errorHandler from 'express-exception-handler';
import serverSentEvents from '../../lib/server-side-events/server';
import attributeMiddleware from './middleware/attribute';
import factMiddleware from './middleware/fact';
import Fact from '../facts/server';
import factsController from './controllers/facts_controller';
import attributesController from './controllers/attributes_controller';
import authentication from './middleware/authentication';

const blobUpload = multer().single('change');
const uid = (req) => req?.oidc?.user?.sub && `us-${md5(req.oidc.user.sub)}`;

Fact.initDB();

async function withAuthForEach(req, res, controllerAction, isAuthorized) {
  if (!req?.oidc?.user?.sub) {
    res.sendStatus(401);
  } else {
    if (!req.signedCookies.userId) {
      res.cookie('userId', uid(req), { signed: true, httpOnly: false, domain: process.env['COOKIE_DOMAIN'] });
    }

    const isAuthorizedAsLoggedInUser = (record) => isAuthorized(uid(req), req, record);

    req.hasedUserID = uid(req);

    await controllerAction(req, res, isAuthorizedAsLoggedInUser);
  }
}

async function withAuth(req, res, controllerAction, isAuthorized) {
  const uploadWrappedControllerAction = (request, response) => {
    blobUpload(request, response, async (err) => {
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

      await controllerAction(request, response);
    });
  };

  if (!req?.oidc?.user?.sub || !(await isAuthorized(uid(req), req))) {
    res.sendStatus(401);
  } else {
    if (!req.signedCookies.userId) {
      res.cookie('userId', uid(req), { signed: true, httpOnly: false, domain: process.env['COOKIE_DOMAIN'] });
    }

    req.hasedUserID = uid(req);

    uploadWrappedControllerAction(req, res);
  }
}

async function isAuthorizedToAccessFact(userid, request, factRecord?) {
  const fact = factRecord || new request.Fact(
    request.body.subject,
    request.body.predicate,
    request.body.object,
  );

  if (fact.predicate === '$isATermFor') {
    return true;
  }

  return fact.matchAny([
    { subject: [['$wasCreatedBy', userid]], object: [['$wasCreatedBy', userid]] },
    { subject: [['$wasCreatedBy', userid]], object: [['$isATermFor', '$anything']] },
  ]);
}

async function isAuthorizedToAccessAttribute(userid, request, attrRecord?) {
  const attribute = attrRecord || request.attribute;
  const attributeId = typeof attribute === 'string' ? attribute : attribute.id;

  const permits = await request.Fact.findAll(
    { subject: [attributeId], predicate: ['$wasCreatedBy'], object: [userid] },
  );

  return permits.length !== 0;
}

const authorizer = {
  isAuthorizedToCreateAttribute: () => true,
  isAuthorizedToReadAttribute: (userid, request, record) => isAuthorizedToAccessAttribute(userid, request, record),
  isAuthorizedToUpdateAttribute: (userid, request) => isAuthorizedToAccessAttribute(userid, request),
  isAuthorizedToCreateFact: (userid, request, record) => isAuthorizedToAccessFact(userid, request, record),
  isAuthorizedToReadFact: (userid, request, fact) => isAuthorizedToAccessFact(userid, request, fact),
  isAuthorizedToUpdateFact: () => false,
};

function createApp() {
  if (!process.env['APP_BASE_URL']) {
    throw new Error('You nee to set the APP_BASE_URL configuration as environment variable.');
  }

  const app = express();

  app.use(cookieParser(process.env['AUTH_COOKIE_SIGNING_SECRET']));
  app.use(express.json());
  app.use(morgan('tiny', { skip: (req) => req.method === 'OPTIONS' }));
  app.use(cors({ origin: process.env['APP_BASE_URL'], credentials: true }));
  app.use(authentication());
  app.use(serverSentEvents());
  app.use('/attributes', attributeMiddleware());
  app.use('/', factMiddleware());

  app.get('/attributes', errorHandler.wrap((req, res) => withAuthForEach(req, res, attributesController.index, authorizer.isAuthorizedToReadAttribute)));
  app.post('/attributes/:attributeId', errorHandler.wrap((req, res) => withAuth(req, res, attributesController.create, authorizer.isAuthorizedToCreateAttribute)));
  app.get('/attributes/:attributeId', errorHandler.wrap((req, res) => withAuth(req, res, attributesController.get, authorizer.isAuthorizedToReadAttribute)));
  app.get('/attributes/:attributeId/changes', errorHandler.wrap((req, res) => withAuth(req, res, attributesController.subsribe, authorizer.isAuthorizedToReadAttribute)));
  app.patch('/attributes/:attributeId', errorHandler.wrap((req, res) => withAuth(req, res, attributesController.update, authorizer.isAuthorizedToUpdateAttribute)));
  app.get('/facts', errorHandler.wrap((req, res) => withAuthForEach(req, res, factsController.index, authorizer.isAuthorizedToReadFact)));
  app.post('/facts', errorHandler.wrap((req, res) => withAuthForEach(req, res, factsController.create, authorizer.isAuthorizedToCreateFact)));

  app.get('/userinfo', errorHandler.wrap((req, res) => {
    if (!req?.oidc?.user?.sub) {
      res.sendStatus(401);
    } else {
      res.cookie('userId', uid(req), { signed: true, httpOnly: false, domain: process.env['COOKIE_DOMAIN'] });
      res.status(200).send('empty response');
    }
  }));

  return app;
}

export default function createServer(options?) {
  const transportDriver = options?.transportDriver || https;
  return transportDriver.createServer(options, createApp());
}

process.on('uncaughtException', (err) => {
  console.log('uncaughtException', err);
});
