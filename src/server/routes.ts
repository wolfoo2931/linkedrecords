/* eslint-disable class-methods-use-this */
/* eslint-disable max-len */
import 'dotenv/config';
import https from 'https';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import multer from 'multer';
import pino from 'pino-http';
import attributeMiddleware from './middleware/attribute';
import factMiddleware from './middleware/fact';
import errorHandler from './middleware/error_handler';
import Fact from '../facts/server';
import factsController from './controllers/facts_controller';
import attributesController from './controllers/attributes_controller';
import userinfoController from './controllers/userinfo_controller';
import authentication from './middleware/authentication';
import mountServiceBus from './service_bus_mount';

const blobUpload = multer().single('change');

Fact.initDB();

async function withAuth(req, res, controllerAction, isAuthorized) {
  const uploadWrappedControllerAction = (request, response) => {
    blobUpload(request, response, async (err) => {
      if (err) {
        req.log.error(`error uploading file for ${req.method} ${req.path}`, err);
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

  await req.whenAuthenticated(async (hashedUserID) => {
    if (await isAuthorized(hashedUserID, req)) {
      uploadWrappedControllerAction(req, res);
    } else {
      res.sendStatus(401);
    }
  });
}

async function isAuthorizedToAccessFact(userid, request, factRecord?) {
  const fact = factRecord || new request.Fact(
    request.body.subject,
    request.body.predicate,
    request.body.object,
  );

  return fact.isAuthorizedToSave(userid);
}

async function isAuthorizedToAccessAttribute(userid, request, attrRecord?) {
  const attribute = attrRecord || request.attribute;
  const attributeId = typeof attribute === 'string' ? attribute : attribute.id;

  return Fact.isAuthorizedToReadPayload(attributeId, userid, request.log);
}

const authorizer = {
  isAuthorizedToCreateAttribute: () => true,
  isAuthorizedToReadAttribute: (userid, request, record) => isAuthorizedToAccessAttribute(userid, request, record),
  isAuthorizedToUpdateAttribute: (userid, request, record?) => isAuthorizedToAccessAttribute(userid, request, record),
  isAuthorizedToCreateFact: (userid, request, record) => isAuthorizedToAccessFact(userid, request, record),
};

async function createApp(httpServer: https.Server) {
  if (!process.env['FRONTEND_BASE_URL']) {
    throw new Error('You nee to set the FRONTEND_BASE_URL configuration as environment variable.');
  }

  const app = express();
  await mountServiceBus(httpServer, app);

  app.use(pino({ redact: ['req.headers', 'res.headers'] }));
  app.use(cookieParser(process.env['AUTH_COOKIE_SIGNING_SECRET']));
  app.use(express.json());
  app.use(cors({ origin: process.env['FRONTEND_BASE_URL'], credentials: true, maxAge: 86400 }));
  app.use(authentication());
  app.use('/attributes', attributeMiddleware());
  app.use('/', factMiddleware());

  app.get('/userinfo', errorHandler((req, res) => userinfoController.userinfo(req, res)));
  app.get('/attributes', errorHandler((req, res) => attributesController.index(req, res)));
  app.post('/attributes/:attributeId', errorHandler((req, res) => withAuth(req, res, attributesController.create, authorizer.isAuthorizedToCreateAttribute)));
  app.get('/attributes/:attributeId', errorHandler((req, res) => withAuth(req, res, attributesController.get, authorizer.isAuthorizedToReadAttribute)));
  app.patch('/attributes/:attributeId', errorHandler((req, res) => withAuth(req, res, attributesController.update, authorizer.isAuthorizedToUpdateAttribute)));
  app.get('/facts', errorHandler((req, res) => withAuth(req, res, factsController.index, () => true)));
  app.post('/facts', errorHandler((req, res) => withAuth(req, res, factsController.create, () => true)));

  return app;
}

export default async function createServer(options?) {
  const transportDriver = options?.transportDriver || https;
  const server = transportDriver.createServer(options);
  server.on('request', await createApp(server));
  return server;
}

process.on('uncaughtException', (err) => {
  console.log('uncaughtException', err);
});
