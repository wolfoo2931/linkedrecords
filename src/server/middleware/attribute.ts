import { LongTextAttribute, PsqlStorage } from '../../attributes/long_text/server';

const storage = new PsqlStorage();

function getAttributeClassByAttributeId(id: string) : any {
    const attributeTypes = [ LongTextAttribute ];

    const [attributeTypePrefix] = id.split('-');
    const attributeClass = attributeTypes.find(c => c.DATA_TYPE_PREFIX === attributeTypePrefix);

    return attributeClass;
}

export function getAttributeByParams(req) {
    const id = req.query?.id || req.params.id;
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