import LongTextAttribute from '../../attributes/long_text/server';
import KeyValueAttribute from '../../attributes/key_value/server';
import { PsqlStorage } from '../../attributes/attribute_storage';
import AbstractAttributeServer from '../../attributes/abstract/abstract_attribute_server';

const storage = new PsqlStorage();

function getAttributeClassByAttributeId(id: string) : any {
  const attributeTypes = [LongTextAttribute, KeyValueAttribute];
  const [attributeTypePrefix] = id.split('-');
  return attributeTypes.find((c) => c.getDataTypePrefix() === attributeTypePrefix);
}

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
  const clientId = req.query?.clientId || req.body?.clientId;
  const actorId = req.query?.actorId || req.body?.actorId;

  if (!AttributeClass) {
    throw new Error(`Server is unkown of Attribute Type Prefix for id ${id}`);
  }

  if (!actorId) {
    throw new Error(`The request does not contain a actorid for attribute id: ${id}`);
  }

  if (!clientId) {
    throw new Error(`The request does not contain a clientId for attribute id: ${id}`);
  }

  return new AttributeClass(id, clientId, actorId, storage);
}

export default function attributeMiddleware() {
  return (req, res, next) => {
    const id = getAttributeIdByRquest(req);

    if (id) {
      req.attributeClass = getAttributeClassByAttributeId(id);
      req.attribute = getAttributeByParams(req, req.attributeClass);
    }

    next();
  };
}
