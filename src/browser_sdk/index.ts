/* eslint-disable max-classes-per-file */
/* eslint-disable import/no-cycle */

import { v4 as uuid } from 'uuid';
import LongTextAttribute from '../attributes/long_text/client';
import KeyValueAttribute from '../attributes/key_value/client';
import ServerSideEvents, { IsSubscribable } from '../../lib/server-side-events/client';
import AbstractAttributeClient from '../attributes/abstract/abstract_attribute_client';
import IsSerializable from '../attributes/abstract/is_serializable';

class AttributeRepository {
  linkedRecords: LinkedRecords;

  private serverSideEvents: IsSubscribable;

  private static attributeTypes = [
    LongTextAttribute,
    KeyValueAttribute,
  ];

  constructor(linkedRecords: LinkedRecords, serverSideEvents: IsSubscribable) {
    this.linkedRecords = linkedRecords;
    this.serverSideEvents = serverSideEvents;
  }

  async create(attributeType: string, value: any)
    :Promise<AbstractAttributeClient<any, IsSerializable>> {
    const AttributeClass = AttributeRepository
      .attributeTypes
      .find((c) => c.getDataTypeName() === attributeType);

    if (!AttributeClass) {
      throw new Error(`Attribute Type ${attributeType} is unknown`);
    }

    const attribute: AbstractAttributeClient<any, IsSerializable> = new AttributeClass(
      this.linkedRecords,
      this.serverSideEvents,
    );

    await attribute.create(value);
    return attribute;
  }

  async find(attributeId: string)
    :Promise<AbstractAttributeClient<any, IsSerializable>> {
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
  serverSideEvents: IsSubscribable;

  serverURL: URL;

  clientId: string;

  actorId: string;

  Attribute: AttributeRepository;

  constructor(serverURL: URL, serverSideEvents?: IsSubscribable) {
    this.serverURL = serverURL;
    this.actorId = uuid();
    this.clientId = uuid();
    this.serverSideEvents = serverSideEvents || new ServerSideEvents();
    this.Attribute = new AttributeRepository(this, this.serverSideEvents);
  }
}
