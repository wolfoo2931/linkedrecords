import { v4 as uuid } from 'uuid';
import { LongTextAttribute } from '../attributes/long_text/client';

const attributeMap = {
    longText: LongTextAttribute
}

class Attribute {
    linkedRecords: LinkedRecords;

    constructor(linkedRecords: LinkedRecords) {
        this.linkedRecords = linkedRecords;
    }

    static async create(dataType: string, value: any) {
        const attributeClass = attributeMap[dataType];
    }
}

export class LinkedRecords {
    serverURL: URL;
    clientId: string;
    actorId: string;
    Attribute: Attribute;

    constructor(serverURL: URL) {
        this.serverURL = serverURL;
        this.actorId = uuid();
        this.clientId = uuid();
        this.Attribute = new Attribute(this);
    }
}