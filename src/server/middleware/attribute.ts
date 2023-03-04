import attributeQuery from '../../attributes/attribute_query';
import { PsqlStorage } from '../../attributes/attribute_storage';
import AbstractAttributeServer from '../../attributes/abstract/abstract_attribute_server';

const storage = new PsqlStorage();

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

export default function attributeMiddleware() {
  return (req, res, next) => {
    const id = getAttributeIdByRquest(req);

    req.attributeStorage = storage;
    req.clientId = req.query?.clientId || req.body?.clientId;
    req.actorId = req.query?.actorId || req.body?.actorId;

    if (id) {
      req.attributeClass = attributeQuery.getAttributeClassByAttributeId(id);
      req.attribute = getAttributeByParams(req, req.attributeClass);
    }

    next();
  };
}
