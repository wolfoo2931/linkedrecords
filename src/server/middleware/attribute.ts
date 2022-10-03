import LongTextAttribute from '../../attributes/long_text/server';
import { PsqlStorage } from '../../attributes/attribute_storage';
import AbstractAttributeServer from '../../attributes/abstract/abstract_attribute_server';

const storage = new PsqlStorage();

function getAttributeClassByAttributeId(id: string) : any {
  const attributeTypes = [LongTextAttribute];
  const [attributeTypePrefix] = id.split('-');
  return attributeTypes.find((c) => c.getDataTypePrefix() === attributeTypePrefix);
}

function getAttributeByParams(req, AttributeClass): AbstractAttributeServer<any, any, any> {
  const id = req.query?.attributeId || req.params.attributeId;
  const clientId = req.query?.clientId || req.body?.clientId;
  const actorId = req.query?.actorId || req.body?.actorId;

  if (!AttributeClass) {
    throw new Error(`Server is unkown of Attribute Type Prefix for id ${id}`);
  }

  return new AttributeClass(id, clientId, actorId, storage);
}

export default function attributeMiddleware() {
  return (req, res, next) => {
    const id = req.query?.attributeId || req.params.attributeId;

    if (id) {
      req.attributeClass = getAttributeClassByAttributeId(id);
      req.attribute = getAttributeByParams(req, req.attributeClass);
    }

    next();
  };
}
