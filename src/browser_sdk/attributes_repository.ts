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

type QueryResult<T> = { [K in keyof T]: TransformQueryRecord<T[K]> };

export type CompositionCreationRequest = {
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

const byId = (a, b) => {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
};

export default class AttributesRepository {
  private linkedRecords: LinkedRecords;

  private getClientServerBus: () => Promise<ClientServerBus>;

  private attributeCache: Record<string, AbstractAttributeClient<any, any>>;

  static attributeTypes = [
    LongTextAttribute,
    KeyValueAttribute,
    BlobAttribute,
  ];

  constructor(linkedRecords: LinkedRecords, getClientServerBus: () => Promise<ClientServerBus>) {
    this.linkedRecords = linkedRecords;
    this.getClientServerBus = getClientServerBus;
    this.attributeCache = {};
  }

  // TODO: we should cache this
  private async idToAttribute(id, ignoreCache: boolean = false, serverState?): Promise<AbstractAttributeClient<any, any> | undefined> {
    const [attributeTypePrefix] = id.split('-');
    const AttributeClass = AttributesRepository
      .attributeTypes
      .find((c) => c.getDataTypePrefix() === attributeTypePrefix);

    if (!AttributeClass) {
      return undefined;
    }

    if (this.attributeCache[id] && !ignoreCache) {
      return this.attributeCache[id];
    }

    const attr = new AttributeClass(this.linkedRecords, await this.getClientServerBus(), id);

    if (serverState) {
      await attr.load(serverState);
    }

    this.attributeCache[id] = attr;

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
      await this.getClientServerBus(),
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

    await Promise.all(Object.entries(resultBody).map(async ([attrName, config]: [string, any]) => {
      if (config.id) {
        const tmpResult = await this.idToAttribute(config.id!, false, config);

        if (!tmpResult) {
          throw new Error(`Error transforming id to attribute: ${config.id}`);
        }

        result[attrName] = tmpResult;
      }
    }));

    // @ts-ignore I don't know how to make him happy here.
    return result;
  }

  async find(attributeId: string, ignoreCache: boolean = false)
    :Promise<AbstractAttributeClient<any, IsSerializable> | undefined> {
    const attribute = await this.idToAttribute(attributeId, ignoreCache);

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
  async findAll<T extends CompoundAttributeQuery>(
    query: T,
    ignoreCache: boolean = false,
  ): Promise<QueryResult<T>> {
    const params = new URLSearchParams();

    params.append('query', stringify(query));

    const result = await this.linkedRecords.fetch(`/attributes?${params.toString()}`);
    const records = await result.json();

    const attributeResult = {} as any;

    await Promise.all(Object.keys(records).map(async (key) => {
      if (Array.isArray(records[key])) {
        attributeResult[key] = (await Promise.all(records[key].map((attr) => this.idToAttribute(attr.id, ignoreCache, attr)))).sort(byId);
      } else if (records[key]) {
        attributeResult[key] = await this.idToAttribute(records[key].id, ignoreCache, records[key]);
      } else {
        attributeResult[key] = null;
      }
    }));

    return attributeResult;
  }

  async findAndLoadAll<T extends CompoundAttributeQuery>(query: T): Promise<QueryResult<T>> {
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

  async subscribeToQuery<T extends CompoundAttributeQuery>(query: T, onChange: (result: QueryResult<T>) => void): Promise<() => void> {
    const bus = await this.linkedRecords.getClientServerBus();
    const url = `${this.linkedRecords.serverURL.toString()}query-sub`;
    const channel = `query-sub:${JSON.stringify(query)}`;

    const [subscription, result] = await Promise.all([
      bus.subscribe(url, channel, undefined, onChange),
      this.findAndLoadAll(query),
    ]);

    onChange(result);

    return () => {
      bus.unsubscribe(subscription);
    };
  }

  clearCache() {
    this.attributeCache = {};
  }
}
