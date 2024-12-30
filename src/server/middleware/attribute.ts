import md5 from 'md5';
import { uuidv7 as uuid } from 'uuidv7';
import QueryExecutor from '../../attributes/attribute_query';
import AttributeStorage from '../../attributes/attribute_storage';
import AbstractAttributeServer from '../../attributes/abstract/abstract_attribute_server';
import IsLogger from '../../../lib/is_logger';

function getAttributeIdByRequest(req) {
  let urlMatch = req.originalUrl.match(/\/attributes\/(.*?)[?&/^]/);

  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  urlMatch = req.originalUrl.match(/\/attributes\/(.*)/);

  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  if (req.originalUrl.match(/\/attributes/)
    && typeof req.query?.dtp === 'string'
    && req.query.dtp.length >= 1
  ) {
    return `${req.query?.dtp}-${uuid()}`;
  }

  return req.query?.attributeId || req.params.attributeId;
}

function getAttributeByParams(req, AttributeClass): AbstractAttributeServer<any, any, any> {
  const id = getAttributeIdByRequest(req);

  if (!AttributeClass) {
    throw new Error(`Server is not aware of Attribute Type Prefix for id ${id}`);
  }

  if (!req.actorId || req.actorId === 'undefined') {
    throw new Error(`The request does not contain a actorId for attribute id: ${id}`);
  }

  if (!req.clientId || req.clientId === 'undefined') {
    throw new Error(`The request does not contain a clientId for attribute id: ${id}`);
  }

  return new AttributeClass(id, req.clientId, req.actorId, req.attributeStorage);
}

export function getAttributeByMessage(
  attributeId,
  message,
  logger: IsLogger,
): AbstractAttributeServer<any, any, any> {
  const AttributeClass = QueryExecutor.getAttributeClassByAttributeId(attributeId);

  if (!AttributeClass) {
    throw new Error(`Server is not aware of Attribute Type Prefix for id ${attributeId}`);
  }

  if (!message.actorId || message.actorId === 'undefined') {
    throw new Error(`The request does not contain a actorId for attribute id: ${attributeId}`);
  }

  if (!message.clientId || message.clientId === 'undefined') {
    throw new Error(`The request does not contain a clientId for attribute id: ${attributeId}`);
  }

  return new AttributeClass(
    attributeId,
    message.clientId,
    message.actorId,
    new AttributeStorage(logger),
    logger,
  );
}

export default function attributeMiddleware() {
  return (req, res, next) => {
    const id = getAttributeIdByRequest(req);

    req.attributeStorage = new AttributeStorage(req.log);
    req.clientId = req.query?.clientId || req.body?.clientId;
    req.actorId = req?.oidc?.user?.sub;

    if (!req.actorId || !req.actorId.trim()) {
      res.sendStatus(401);
    } else {
      try {
        req.actorId = `us-${md5(req.actorId)}`;

        if (id) {
          req.attributeClass = QueryExecutor.getAttributeClassByAttributeId(id);
          req.attribute = getAttributeByParams(req, req.attributeClass);
        }

        next();
      } catch (ex: any) {
        if (ex?.message?.startsWith('Server is not aware of Attribute Type Prefix for id')) {
          res.status(404).send(ex?.message);
        } else {
          req.log.error(ex);
          res.sendStatus(500);
        }
      }
    }
  };
}
