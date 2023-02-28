/* eslint-disable import/no-cycle */
import LinkedRecords from '.';
import AbstractAttributeClient from '../attributes/abstract/abstract_attribute_client';
import IsSerializable from '../attributes/abstract/is_serializable';
import LongTextAttribute from '../attributes/long_text/client';
import KeyValueAttribute from '../attributes/key_value/client';
import BlobAttribute from '../attributes/blob/client';
import { CompoundAttributeQuery } from '../attributes/attribute_query';
import { IsSubscribable } from '../../lib/server-side-events/client';

export default class AttributesRepository {
  linkedRecords: LinkedRecords;

  private serverSideEvents: IsSubscribable;

  static attributeTypes = [
    LongTextAttribute,
    KeyValueAttribute,
    BlobAttribute,
  ];

  constructor(linkedRecords: LinkedRecords, serverSideEvents: IsSubscribable) {
    this.linkedRecords = linkedRecords;
    this.serverSideEvents = serverSideEvents;
  }

  idToAttribute(id, serverState?) {
    const [attributeTypePrefix] = id.split('-');
    const AttributeClass = AttributesRepository
      .attributeTypes
      .find((c) => c.getDataTypePrefix() === attributeTypePrefix);

    if (!AttributeClass) {
      return undefined;
    }

    const attr = new AttributeClass(this.linkedRecords, this.serverSideEvents, id);

    if (serverState) {
      attr.load(serverState);
    }

    return attr;
  }

  async create(attributeType: string, value: any, facts?: [ string?, string? ][])
    :Promise<AbstractAttributeClient<any, IsSerializable>> {
    const AttributeClass = AttributesRepository
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

    if (facts) {
      await this.linkedRecords.Fact.createAll(facts.map(([p, o]) => [attribute.id, p, o]));
    }

    return attribute;
  }

  // FIXME: use idToAttribute
  async find(attributeId: string)
    :Promise<AbstractAttributeClient<any, IsSerializable>> {
    const [attributeTypePrefix] = attributeId.split('-');
    const AttributeClass = AttributesRepository
      .attributeTypes
      .find((c) => c.getDataTypePrefix() === attributeTypePrefix);

    if (!AttributeClass) {
      throw new Error(`Attribute ID ${attributeId} is unknown`);
    }

    const attribute = new AttributeClass(this.linkedRecords, this.serverSideEvents, attributeId);
    await attribute.get();
    return attribute;
  }

  // TODO: check for null values in the query
  async findAll(query: CompoundAttributeQuery)
    : Promise<
    { [key: string]: AbstractAttributeClient<any, any>[] | AbstractAttributeClient<any, any> }
    > {
    const params = new URLSearchParams();
    params.append('query', JSON.stringify(query));

    const result = await this.linkedRecords.fetch(`/attributes?${params.toString()}`);
    const records = await result.json();

    const attributeResult = {};

    Object.keys(records).forEach((key) => {
      if (Array.isArray(records[key])) {
        attributeResult[key] = records[key].map((attr) => this.idToAttribute(attr.id, attr));
      } else if (records[key]) {
        attributeResult[key] = this.idToAttribute(records[key].id);
      } else {
        attributeResult[key] = null;
      }
    });

    return attributeResult;
  }
}
