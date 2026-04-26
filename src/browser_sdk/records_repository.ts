/* eslint-disable max-len */
/* eslint-disable import/no-cycle */
import LinkedRecords from '.';
import AbstractRecordClient from '../records/abstract/abstract_record_client';
import IsSerializable from '../records/abstract/is_serializable';
import LongTextRecord from '../records/long_text/client';
import KeyValueRecord from '../records/key_value/client';
import BlobRecord from '../records/blob/client';
import { CompoundAttributeQuery, FactQueryWithOptionalSubjectPlaceholder } from '../records/record_query';
import ClientServerBus from '../../lib/client-server-bus/client';

type ArrayContains<T, U> = T extends Array<infer E>
  ? Extract<E, U> extends never
    ? T & Array<U>
    : T
  : never;

type ConcreteTypedArray<X> =
  X extends ArrayContains<X, [string, string, typeof KeyValueRecord] | [string, typeof KeyValueRecord]> ? Array<KeyValueRecord> :
    X extends ArrayContains<X, [string, string, typeof LongTextRecord] | [string, typeof LongTextRecord]> ? Array<LongTextRecord> :
      X extends ArrayContains<X, [string, string, typeof BlobRecord] | [string, typeof BlobRecord]> ? Array<BlobRecord> :
        Array<AbstractRecordClient<any, any>>;

type TransformQueryRecord<X>
  = X extends Array<FactQueryWithOptionalSubjectPlaceholder> ? ConcreteTypedArray<X> : AbstractRecordClient<any, any>;

type TransformCompositionCreationResult<X extends { type?: typeof AbstractRecordClient<any, IsSerializable> | string }> =
  X['type'] extends typeof KeyValueRecord ? KeyValueRecord :
    X['type'] extends typeof LongTextRecord ? LongTextRecord :
      X['type'] extends typeof BlobRecord ? BlobRecord :
        X['type'] extends string ? AbstractRecordClient<any, IsSerializable> :
          KeyValueRecord;

type QueryResult<T> = { [K in keyof T]: TransformQueryRecord<T[K]> };

export type CompositionCreationRequest = {
  [k: string]: {
    type?: typeof AbstractRecordClient<any, IsSerializable> | string,
    facts?: [string, string, string?][] | undefined,
    value?: any,
  }
};

const stringify = (query) => JSON.stringify(query, (_, v) => {
  if (v === KeyValueRecord) {
    return 'KeyValueAttribute';
  }

  if (v === LongTextRecord) {
    return 'LongTextAttribute';
  }

  if (v === BlobRecord) {
    return 'BlobAttribute';
  }

  return v;
});

const byId = (a, b) => {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
};

export default class RecordsRepository {
  private linkedRecords: LinkedRecords;

  private getClientServerBus: () => Promise<ClientServerBus>;

  private attributeCache: { [key: string]: AbstractRecordClient<any, any> };

  static attributeTypes = [
    LongTextRecord,
    KeyValueRecord,
    BlobRecord,
  ];

  constructor(linkedRecords: LinkedRecords, getClientServerBus: () => Promise<ClientServerBus>) {
    this.linkedRecords = linkedRecords;
    this.getClientServerBus = getClientServerBus;
    this.attributeCache = {};
  }

  // TODO: we should cache this
  private async idToAttribute(id, ignoreCache: boolean = false, serverState?): Promise<AbstractRecordClient<any, any> | undefined> {
    const [attributeTypePrefix] = id.split('-');
    const AttributeClass = RecordsRepository
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
  ): Promise<KeyValueRecord> {
    const attr = await this.create('keyValue', value || {}, facts);
    return attr as KeyValueRecord;
  }

  async createLongText(
    value?: string,
    facts?: [ string, string, string? ][],
  ): Promise<LongTextRecord> {
    const attr = await this.create('longText', value || '', facts);
    return attr as LongTextRecord;
  }

  async createBlob(
    value?: Blob,
    facts?: [ string, string, string? ][],
  ): Promise<BlobRecord> {
    const attr = await this.create('blob', value || '', facts);
    return attr as BlobRecord;
  }

  async create(attributeType: string, value: any, facts?: [ string, string, string? ][])
    :Promise<AbstractRecordClient<any, IsSerializable>> {
    const AttributeClass = RecordsRepository
      .attributeTypes
      .find((c) => c.getDataTypeName() === attributeType);

    if (!AttributeClass) {
      throw new Error(`Attribute Type ${attributeType} is unknown`);
    }

    const attribute: AbstractRecordClient<any, IsSerializable> = new AttributeClass(
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
    const url = `/record-compositions?clientId=${this.linkedRecords.clientId}`;

    const rawResult = await this.linkedRecords.fetch(url, {
      method: 'POST',
      body: stringify(attr),
    });

    if (!rawResult) {
      throw new Error('error creating attribute composition');
    }

    const resultBody = await rawResult.json();

    const result: { [key: string]: AbstractRecordClient<any, any> } = {};

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
    :Promise<AbstractRecordClient<any, IsSerializable> | undefined> {
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

    const result = await this.linkedRecords.fetch(`/records?${params.toString()}`);
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
          (result[compoundName] as Array<AbstractRecordClient<any, any>>).forEach((attr) => {
            promises.push(attr.load());
          });
        } else {
          promises.push((result[compoundName] as AbstractRecordClient<any, any>).load());
        }
      }
    });

    await Promise.all(promises);

    return result;
  }

  async subscribeToQuery<T extends CompoundAttributeQuery>(query: T, onChange: (result: QueryResult<T>) => void): Promise<() => void> {
    if (!this.linkedRecords.actorId) {
      throw new Error('Not ready to subscribe to queries yet: this.linkedRecords.actorId is not initialized');
    }

    const bus = await this.getClientServerBus();
    const url = new URL('query-sub', this.linkedRecords.serverURL).toString();
    const channel = `query-sub:${this.linkedRecords.actorId}:${stringify(query)}`;

    const onPossibleChange = () => {
      this.findAndLoadAll(query).then(onChange);
    };

    const subscription = await bus.subscribe(url, channel, undefined, onPossibleChange);

    onPossibleChange();

    return () => {
      bus.unsubscribe(subscription);
    };
  }

  clearCache() {
    this.attributeCache = {};
  }
}

export { RecordsRepository as AttributesRepository };
