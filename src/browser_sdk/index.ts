import { v4 as uuid } from 'uuid';
import { LongTextAttribute } from '../attributes/long_text/client';

class AttributeRepository {
    linkedRecords: LinkedRecords;

    private static attributeTypes = [ LongTextAttribute ];

    constructor(linkedRecords: LinkedRecords) {
        this.linkedRecords = linkedRecords;
    }

    async create(attributeType: string, value: any) {
        const attributeClass = AttributeRepository.attributeTypes.find(c => c.getDataTypeName() === attributeType);

        if(!attributeClass) {
            throw `Attribute Type ${attributeType} is unknown`;
        }

        const attribute = new attributeClass(this.linkedRecords);

        await attribute.create(value);
        return attribute;
    }

    async find(attributeId: string) {
        const [attributeTypePrefix] = attributeId.split('-');
        const attributeClass = AttributeRepository.attributeTypes.find(c => c.getDataTypePrefix() === attributeTypePrefix);

        if(!attributeClass) {
            throw `Attribute ID ${attributeId} is unknown`;
        }

        return new attributeClass(this.linkedRecords, attributeId);
    }
}

export class LinkedRecords {
    serverURL: URL;
    clientId: string;
    actorId: string;
    Attribute: AttributeRepository;

    constructor(serverURL: URL) {
        this.serverURL = serverURL;
        this.actorId = uuid();
        this.clientId = uuid();
        this.Attribute = new AttributeRepository(this);
    }
}