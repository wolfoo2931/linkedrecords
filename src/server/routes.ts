/* eslint-disable class-methods-use-this */
/* eslint-disable max-len */
import 'dotenv/config';
import https from 'https';
import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import multer from 'multer';
import pino from 'pino-http';
import clientServerBus from '../../lib/client-server-bus/server';
import attributeMiddleware, { getAttributeByMessage } from './middleware/attribute';
import factMiddleware from './middleware/fact';
import errorHandler from './middleware/error_handler';
import Fact from '../facts/server';
import factsController from './controllers/facts_controller';
import attributesController from './controllers/attributes_controller';
import userinfoController, { uid } from './controllers/userinfo_controller';
import authentication from './middleware/authentication';
import SerializedChangeWithMetadata from '../attributes/abstract/serialized_change_with_metadata';
import IsLogger from '../../lib/is_logger';

const blobUpload = multer().single('change');

Fact.initDB();

async function withAuthForEach(req, res, controllerAction, isAuthorized) {
  await req.whenAuthenticated(async (hashedUserID) => {
    await controllerAction(req, res, (record) => isAuthorized(hashedUserID, req, record));
  });
}

async function withAuth(req, res, controllerAction, isAuthorized, isEachFactCreationAuthorized?) {
  const uploadWrappedControllerAction = (request, response, _hashedUserID, _isEachFactCreationAuthorized) => {
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

      await controllerAction(request, response, (record) => _isEachFactCreationAuthorized(_hashedUserID, req, record));
    });
  };

  await req.whenAuthenticated(async (hashedUserID) => {
    if (await isAuthorized(hashedUserID, req)) {
      uploadWrappedControllerAction(req, res, hashedUserID, isEachFactCreationAuthorized);
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

  if (!userid || !userid.trim()) {
    return false;
  }

  if (fact.predicate === '$isATermFor') {
    return true;
  }

  if (userid === fact.object) {
    return fact.matchAny([
      { subject: [['$wasCreatedBy', userid]] },
    ]);
  }

  return fact.matchAny([
    { subject: [['$wasCreatedBy', userid]], object: [['$wasCreatedBy', userid]] },
    { subject: [['$wasCreatedBy', userid]], object: [['$isATermFor', '$anything']] },
  ]);
}

async function isAuthorizedToAccessAttribute(userid, request, attrRecord?) {
  const attribute = attrRecord || request.attribute;
  const attributeId = typeof attribute === 'string' ? attribute : attribute.id;

  const permits = await Fact.findAll(
    { subject: [attributeId], predicate: ['$wasCreatedBy'], object: [userid] },
    request.log,
  );

  return permits.length !== 0;
}

const authorizer = {
  isAuthorizedToCreateAttribute: () => true,
  isAuthorizedToReadAttribute: (userid, request, record) => isAuthorizedToAccessAttribute(userid, request, record),
  isAuthorizedToUpdateAttribute: (userid, request, record?) => isAuthorizedToAccessAttribute(userid, request, record),
  isAuthorizedToCreateFact: (userid, request, record) => isAuthorizedToAccessFact(userid, request, record),
  isAuthorizedToReadFact: (userid, request, fact) => isAuthorizedToAccessFact(userid, request, fact),
  isAuthorizedToUpdateFact: () => false,
};

class WSAccessControl {
  app: any;

  constructor(app) {
    this.app = app;
  }

  public verifyAuthenticated(
    request: http.IncomingMessage,
  ): Promise<string> {
    const response = new http.ServerResponse(request);

    return new Promise((resolve, reject) => {
      this.app.handle(request, response, () => {
        const { oidc } = request as any;

        if (!oidc || !oidc.isAuthenticated() || !oidc?.user?.sub) {
          reject();
        } else {
          resolve(uid(request));
        }
      });
    });
  }

  public async verifyAuthorizedChannelJoin(
    userId: string,
    channel: string,
    request: http.IncomingMessage,
  ): Promise<boolean> {
    if (!userId) {
      return Promise.resolve(false);
    }

    return authorizer.isAuthorizedToReadAttribute(userId, request, channel);
  }

  public async verifyAuthorizedSend(
    userId: string,
    channel: string,
    request: http.IncomingMessage,
  ): Promise<boolean> {
    if (!userId) {
      return Promise.resolve(false);
    }

    return authorizer.isAuthorizedToUpdateAttribute(userId, request, channel);
  }
}

async function createApp(httpServer: https.Server) {
  if (!process.env['FRONTEND_BASE_URL']) {
    throw new Error('You nee to set the FRONTEND_BASE_URL configuration as environment variable.');
  }

  const app = express();

  const sendMessage = await clientServerBus(httpServer, app, new WSAccessControl(app), async (attributeId, change, request) => {
    const attribute = getAttributeByMessage(attributeId, change, request.log as unknown as IsLogger);

    const committedChange: SerializedChangeWithMetadata<any> = await attribute.change(
      change,
    );

    sendMessage(attributeId, committedChange);
  });

  app.use(pino({ redact: ['req.headers', 'res.headers'] }));
  app.use(cookieParser(process.env['AUTH_COOKIE_SIGNING_SECRET']));
  app.use(express.json());
  app.use(cors({ origin: process.env['FRONTEND_BASE_URL'], credentials: true, maxAge: 86400 }));
  app.use(authentication());
  app.use('/attributes', attributeMiddleware());
  app.use('/', factMiddleware());

  app.get('/userinfo', errorHandler((req, res) => userinfoController.userinfo(req, res)));
  app.get('/attributes', errorHandler((req, res) => withAuthForEach(req, res, attributesController.index, authorizer.isAuthorizedToReadAttribute)));
  app.post('/attributes/:attributeId', errorHandler((req, res) => withAuth(req, res, attributesController.create, authorizer.isAuthorizedToCreateAttribute, authorizer.isAuthorizedToCreateFact)));
  app.get('/attributes/:attributeId', errorHandler((req, res) => withAuth(req, res, attributesController.get, authorizer.isAuthorizedToReadAttribute)));
  app.get('/attributes/:attributeId/changes', errorHandler((req, res) => withAuth(req, res, attributesController.subscribe, authorizer.isAuthorizedToReadAttribute)));
  app.patch('/attributes/:attributeId', errorHandler((req, res) => withAuth(req, res, attributesController.update, authorizer.isAuthorizedToUpdateAttribute)));
  app.get('/facts', errorHandler((req, res) => withAuthForEach(req, res, factsController.index, authorizer.isAuthorizedToReadFact)));
  app.post('/facts', errorHandler((req, res) => withAuthForEach(req, res, factsController.create, authorizer.isAuthorizedToCreateFact)));

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
