/* eslint-disable class-methods-use-this */
/* eslint-disable max-len */
import 'dotenv/config';
import https from 'https';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import multer from 'multer';
import pino from 'pino-http';
import { rateLimit } from 'express-rate-limit';
import attributeMiddleware from './middleware/attribute';
import factMiddleware from './middleware/fact';
import errorHandler from './middleware/error_handler';
import Fact from '../facts/server';
import factsController from './controllers/facts_controller';
import attributesController from './controllers/attributes_controller';
import quotaController from './controllers/quota_controller';
import userinfoController from './controllers/userinfo_controller';
import authentication from './middleware/authentication';
import quotaUpgrade from './middleware/quota_upgrade';
import mountServiceBus from './service_bus_mount';
import AuthorizationError from '../attributes/errors/authorization_error';
import clearCookies from './middleware/clear_cookies';

const blobUpload = multer().single('change');

const limiter = rateLimit({
  windowMs: 1000, // 1 second
  limit: 1000, // Limit each IP to 1000 requests per `window` (here, per 1 minute).
});

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
    } catch (ex: any) {
      if (ex instanceof AuthorizationError) {
        res.sendStatus(401);
      } else if (ex?.message?.startsWith('Not enough storage space available')) {
        res.status(403).send('Not enough storage space available');
      } else { // TODO: this should be moved into the error handler
        req.log.error(ex);
        res.sendStatus(500);
      }
    }
  });
}

function getCorsOriginConfig(): string | string[] {
  if (!process.env['CORS_ORIGIN']) {
    if (!process.env['FRONTEND_BASE_URL']) {
      throw new Error('You nee to set the FRONTEND_BASE_URL configuration as environment variable.');
    }

    return process.env['FRONTEND_BASE_URL'];
  }

  let parsed = process.env['CORS_ORIGIN'];

  try {
    parsed = JSON.parse(parsed);
  } catch (ex) {
    // It just URL string, not parsable
  }

  if (typeof parsed === 'string' || Array.isArray(parsed)) {
    return parsed;
  }

  throw new Error(`Invalid value (${process.env['CORS_ORIGIN']}) for CORS_ORIGIN, needs to be string or JSON array. `);
}

async function createApp(httpServer: https.Server) {
  if (!process.env['FRONTEND_BASE_URL']) {
    throw new Error('You nee to set the FRONTEND_BASE_URL configuration as environment variable.');
  }

  const app = express();
  await mountServiceBus(httpServer, app);

  app.use(limiter);
  app.use(cors({ origin: getCorsOriginConfig(), credentials: true, maxAge: 86400 }));
  app.use(pino({ redact: ['req.headers', 'res.headers'] }));
  app.use(cookieParser(process.env['AUTH_COOKIE_SIGNING_SECRET']));
  app.use('/payment_events', quotaUpgrade());
  app.use(express.json());
  app.use('/logout', clearCookies());
  app.use(authentication());
  app.use('/attributes', attributeMiddleware());
  app.use('/attribute-compositions', attributeMiddleware());
  app.use('/', factMiddleware());

  app.get('/userinfo', errorHandler((req, res) => userinfoController.userinfo(req, res)));
  app.get('/quota/:nodeId', errorHandler((req, res) => withAuth(req, res, quotaController.get)));
  app.get('/attributes', errorHandler((req, res) => withAuth(req, res, attributesController.index)));
  app.post('/attributes', errorHandler((req, res) => withAuth(req, res, attributesController.create)));
  app.post('/attribute-compositions', errorHandler((req, res) => withAuth(req, res, attributesController.createComposition)));
  app.get('/attributes/:attributeId', errorHandler((req, res) => withAuth(req, res, attributesController.get)));
  app.get('/attributes/:attributeId/members', errorHandler((req, res) => withAuth(req, res, attributesController.getMembers)));
  app.patch('/attributes/:attributeId', errorHandler((req, res) => withAuth(req, res, attributesController.update)));
  app.get('/facts', errorHandler((req, res) => withAuth(req, res, factsController.index)));
  app.post('/facts', errorHandler((req, res) => withAuth(req, res, factsController.create)));
  app.post('/facts/delete', errorHandler((req, res) => withAuth(req, res, factsController.delete)));

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
