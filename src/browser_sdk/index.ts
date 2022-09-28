/* eslint-disable max-classes-per-file */
/* eslint-disable import/no-cycle */

import { v4 as uuid } from 'uuid';
import LongTextAttribute from '../attributes/long_text/client';
import ServerSideEvents from '../../lib/server-side-events/client';

class AttributeRepository {
  linkedRecords: LinkedRecords;

  serverSideEvents: ServerSideEvents = new ServerSideEvents();

  private static attributeTypes = [LongTextAttribute];

  constructor(linkedRecords: LinkedRecords) {
    this.linkedRecords = linkedRecords;
  }

  async create(attributeType: string, value: any) {
    const AttributeClass = AttributeRepository
      .attributeTypes
      .find((c) => c.getDataTypeName() === attributeType);

    if (!AttributeClass) {
      throw new Error(`Attribute Type ${attributeType} is unknown`);
    }

    const attribute = new AttributeClass(this.linkedRecords, this.serverSideEvents);

    await attribute.create(value);
    return attribute;
  }

  async find(attributeId: string) {
    const [attributeTypePrefix] = attributeId.split('-');
    const AttributeClass = AttributeRepository
      .attributeTypes
      .find((c) => c.getDataTypePrefix() === attributeTypePrefix);

    if (!AttributeClass) {
      throw new Error(`Attribute ID ${attributeId} is unknown`);
    }

    const attribute = new AttributeClass(this.linkedRecords, this.serverSideEvents, attributeId);
    await attribute.get();
    return attribute;
  }
}

export default class LinkedRecords {
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
