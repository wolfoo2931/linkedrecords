import { LongTextAttribute, PsqlStorage } from '../../attributes/long_text/server';
import AbstractAttributeServer from '../../attributes/abstract/abstract_attribute_server';

const storage = new PsqlStorage();

function getAttributeClassByAttributeId(id: string) : any {
    const attributeTypes = [ LongTextAttribute ];
    const [attributeTypePrefix] = id.split('-');
    const attributeClass = attributeTypes.find(c => c.getDataTypePrefix() === attributeTypePrefix);

    return attributeClass;
}

export function getAttributeByParams(req): AbstractAttributeServer<any, any, any> {
    const id = req.query?.attributeId || req.params.attributeId;
    const clientId = req.query?.clientId || req.body?.clientId;
    const actorId = req.query?.actorId || req.body?.actorId;

    const attributeClass = getAttributeClassByAttributeId(id);

    if(!attributeClass) {
        throw `Server is unkown of Attribute Type Prefix for id ${id}`
    }

    return new attributeClass(id, clientId, actorId, storage);
}

export default function AttributeMiddleware(req, res, next) {
    req.attribute = getAttributeByParams(req)
    next();
}