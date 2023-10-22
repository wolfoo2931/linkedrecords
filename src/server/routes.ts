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
import AuthorizationError from '../attributes/errors/authorization_error';

const blobUpload = multer().single('change');

Fact.initDB();

async function withAuth(req, res, controllerAction) {
  const uploadWrappedControllerAction = (request, response) => new Promise((resolve, reject) => {
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

      controllerAction(request, response)
        .catch(reject)
        .then(resolve);
    });
  });

  await req.whenAuthenticated(async () => {
    try {
      await uploadWrappedControllerAction(req, res);
    } catch (ex) {
      if (ex instanceof AuthorizationError) {
        res.sendStatus(401);
      } else {
        res.sendStatus(500);
      }
    }
  });
}

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
  app.post('/attributes/:attributeId', errorHandler((req, res) => withAuth(req, res, attributesController.create)));
  app.get('/attributes/:attributeId', errorHandler((req, res) => withAuth(req, res, attributesController.get)));
  app.patch('/attributes/:attributeId', errorHandler((req, res) => withAuth(req, res, attributesController.update)));
  app.get('/facts', errorHandler((req, res) => withAuth(req, res, factsController.index)));
  app.post('/facts', errorHandler((req, res) => withAuth(req, res, factsController.create)));

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
