/* eslint-disable max-len */
/* eslint-disable import/no-cycle */
import LinkedRecords from '.';
import AbstractAttributeClient from '../attributes/abstract/abstract_attribute_client';
import IsSerializable from '../attributes/abstract/is_serializable';
import LongTextAttribute from '../attributes/long_text/client';
import KeyValueAttribute from '../attributes/key_value/client';
import BlobAttribute from '../attributes/blob/client';
import { CompoundAttributeQuery, FactQueryWithOptionalSubjectPlaceholder } from '../attributes/attribute_query';
import ClientServerBus from '../../lib/client-server-bus/client';

type ArrayContains<T, U> = T extends Array<infer E>
  ? Extract<E, U> extends never
    ? T & Array<U>
    : T
  : never;

type ConcreteTypedArray<X> =
  X extends ArrayContains<X, [string, string, typeof KeyValueAttribute] | [string, typeof KeyValueAttribute]> ? Array<KeyValueAttribute> :
    X extends ArrayContains<X, [string, string, typeof LongTextAttribute] | [string, typeof LongTextAttribute]> ? Array<LongTextAttribute> :
      X extends ArrayContains<X, [string, string, typeof BlobAttribute] | [string, typeof BlobAttribute]> ? Array<BlobAttribute> :
        Array<AbstractAttributeClient<any, any>>;

type TransformQueryRecord<X>
  = X extends Array<FactQueryWithOptionalSubjectPlaceholder> ? ConcreteTypedArray<X> : AbstractAttributeClient<any, any>;

type TransformCompositionCreationResult<X extends { type?: typeof AbstractAttributeClient<any, IsSerializable> | string }> =
  X['type'] extends typeof KeyValueAttribute ? KeyValueAttribute :
    X['type'] extends typeof LongTextAttribute ? LongTextAttribute :
      X['type'] extends typeof BlobAttribute ? BlobAttribute :
        X['type'] extends string ? AbstractAttributeClient<any, IsSerializable> :
          KeyValueAttribute;

type CompositionCreationRequest = {
  [k: string]: {
    type?: typeof AbstractAttributeClient<any, IsSerializable> | string,
    facts?: [string, string, string?][] | undefined,
    value?: any,
  }
};

const stringify = (query) => JSON.stringify(query, (_, v) => {
  if (v === KeyValueAttribute) {
    return 'KeyValueAttribute';
  }

  if (v === LongTextAttribute) {
    return 'LongTextAttribute';
  }

  if (v === BlobAttribute) {
    return 'BlobAttribute';
  }

  return v;
});

export default class AttributesRepository {
  private linkedRecords: LinkedRecords;

  private clientServerBus: ClientServerBus;

  static attributeTypes = [
    LongTextAttribute,
    KeyValueAttribute,
    BlobAttribute,
  ];

  constructor(linkedRecords: LinkedRecords, clientServerBus: ClientServerBus) {
    this.linkedRecords = linkedRecords;
    this.clientServerBus = clientServerBus;
  }

  private idToAttribute(id, serverState?): AbstractAttributeClient<any, any> | undefined {
    const [attributeTypePrefix] = id.split('-');
    const AttributeClass = AttributesRepository
      .attributeTypes
      .find((c) => c.getDataTypePrefix() === attributeTypePrefix);

    if (!AttributeClass) {
      return undefined;
    }

    const attr = new AttributeClass(this.linkedRecords, this.clientServerBus, id);

    if (serverState) {
      attr.load(serverState);
    }

    return attr;
  }

  async createKeyValue(
    value?: object,
    facts?: [ string, string, string?][],
  ): Promise<KeyValueAttribute> {
    const attr = await this.create('keyValue', value || {}, facts);
    return attr as KeyValueAttribute;
  }

  async createLongText(
    value?: string,
    facts?: [ string, string, string? ][],
  ): Promise<LongTextAttribute> {
    const attr = await this.create('longText', value || '', facts);
    return attr as LongTextAttribute;
  }

  async createBlob(
    value?: Blob,
    facts?: [ string, string, string? ][],
  ): Promise<BlobAttribute> {
    const attr = await this.create('blob', value || '', facts);
    return attr as BlobAttribute;
  }

  async create(attributeType: string, value: any, facts?: [ string, string, string? ][])
    :Promise<AbstractAttributeClient<any, IsSerializable>> {
    const AttributeClass = AttributesRepository
      .attributeTypes
      .find((c) => c.getDataTypeName() === attributeType);

    if (!AttributeClass) {
      throw new Error(`Attribute Type ${attributeType} is unknown`);
    }

    const attribute: AbstractAttributeClient<any, IsSerializable> = new AttributeClass(
      this.linkedRecords,
      this.clientServerBus,
    );

    await attribute.create(value, facts);

    return attribute;
  }

  async createAll<CCR extends CompositionCreationRequest>(attr: CCR)
    : Promise<{
      [K in keyof CCR]: TransformCompositionCreationResult<CCR[K]>
    }> {
    const url = `/attribute-compositions?clientId=${this.linkedRecords.clientId}`;

    const rawResult = await this.linkedRecords.fetch(url, {
      method: 'POST',
      body: stringify(attr),
    });

    if (!rawResult) {
      throw new Error('error creating attribute composition');
    }

    const resultBody = await rawResult.json();

    const result: { [key: string]: AbstractAttributeClient<any, any> } = {};

    Object.entries(resultBody).forEach(([attrName, config]: [string, any]) => {
      if (config.id) {
        const tmpResult = this.idToAttribute(config.id!, config);

        if (!tmpResult) {
          throw new Error(`Error transforming id to attribute: ${config.id}`);
        }

        result[attrName] = tmpResult;
      }
    });

    // @ts-ignore I don't know how to make him happy here.
    return result;
  }

  async find(attributeId: string)
    :Promise<AbstractAttributeClient<any, IsSerializable> | undefined> {
    const attribute = await this.idToAttribute(attributeId);

    if (!attribute) {
      throw new Error(`Attribute ID ${attributeId} is unknown`);
    }

    const isOk = await attribute.get();

    if (!isOk) {
      return undefined;
    }

    return attribute;
  }

  // TODO: check for null values in the query
  async findAll<T extends CompoundAttributeQuery>(query: T)
    : Promise<
    { [K in keyof T]: TransformQueryRecord<T[K]> }
    > {
    const params = new URLSearchParams();

    params.append('query', stringify(query));

    const result = await this.linkedRecords.fetch(`/attributes?${params.toString()}`);
    const records = await result.json();

    const attributeResult = {} as any;

    Object.keys(records).forEach((key) => {
      if (Array.isArray(records[key])) {
        attributeResult[key] = records[key].map((attr) => this.idToAttribute(attr.id, attr));
      } else if (records[key]) {
        attributeResult[key] = this.idToAttribute(records[key].id, records[key]);
      } else {
        attributeResult[key] = null;
      }
    });

    return attributeResult;
  }

  async findAndLoadAll<T extends CompoundAttributeQuery>(query: T)
    : Promise<
    { [K in keyof T]: TransformQueryRecord<T[K]> }
    > {
    const result = await this.findAll(query);
    const promises: Promise<boolean>[] = [];

    Object.keys(result).forEach((compoundName) => {
      if (result[compoundName]) {
        if (Array.isArray(result[compoundName])) {
          (result[compoundName] as Array<AbstractAttributeClient<any, any>>).forEach((attr) => {
            promises.push(attr.load());
          });
        } else {
          promises.push((result[compoundName] as AbstractAttributeClient<any, any>).load());
        }
      }
    });

    await Promise.all(promises);

    return result;
  }
}
