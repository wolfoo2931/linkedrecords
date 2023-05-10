import md5 from 'md5';
import QueryExecutor from '../../attributes/attribute_query';
import { PsqlStorage } from '../../attributes/attribute_storage';
import AbstractAttributeServer from '../../attributes/abstract/abstract_attribute_server';
import IsLogger from '../../../lib/is_logger';

function getAttributeIdByRquest(req) {
  let urlMatch = req.originalUrl.match(/\/attributes\/(.*?)[?&/^]/);

  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  urlMatch = req.originalUrl.match(/\/attributes\/(.*)/);

  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  return req.query?.attributeId || req.params.attributeId;
}

function getAttributeByParams(req, AttributeClass): AbstractAttributeServer<any, any, any> {
  const id = getAttributeIdByRquest(req);

  if (!AttributeClass) {
    throw new Error(`Server is unkown of Attribute Type Prefix for id ${id}`);
  }

  if (!req.actorId || req.actorId === 'undefined') {
    throw new Error(`The request does not contain a actorid for attribute id: ${id}`);
  }

  if (!req.clientId || req.clientId === 'undefined') {
    throw new Error(`The request does not contain a clientId for attribute id: ${id}`);
  }

  return new AttributeClass(id, req.clientId, req.actorId, req.attributeStorage);
}

export function getAttributeByMessage(attributeId, message, logger: IsLogger) {
  const AttributeClass = QueryExecutor.getAttributeClassByAttributeId(attributeId);

  if (!AttributeClass) {
    throw new Error(`Server is unkown of Attribute Type Prefix for id ${attributeId}`);
  }

  if (!message.actorId || message.actorId === 'undefined') {
    throw new Error(`The request does not contain a actorid for attribute id: ${attributeId}`);
  }

  if (!message.clientId || message.clientId === 'undefined') {
    throw new Error(`The request does not contain a clientId for attribute id: ${attributeId}`);
  }

  return new AttributeClass(
    attributeId,
    message.clientId,
    message.actorId,
    new PsqlStorage(logger),
    logger,
  );
}

export default function attributeMiddleware() {
  return (req, res, next) => {
    const id = getAttributeIdByRquest(req);

    req.attributeStorage = new PsqlStorage(req.log);
    req.clientId = req.query?.clientId || req.body?.clientId;
    req.actorId = req?.oidc?.user?.sub;

    if (!req.actorId || !req.actorId.trim()) {
      res.sendStatus(401);
    } else {
      req.actorId = `us-${md5(req.actorId)}`;
      if (id) {
        req.attributeClass = QueryExecutor.getAttributeClassByAttributeId(id);
        req.attribute = getAttributeByParams(req, req.attributeClass);
      }

      next();
    }
  };
}
