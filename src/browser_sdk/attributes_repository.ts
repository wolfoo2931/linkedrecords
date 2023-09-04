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
  = (X extends Array<FactQueryWithOptionalSubjectPlaceholder>
    ? ConcreteTypedArray<X> : AbstractAttributeClient<any, any>);

export default class AttributesRepository {
  linkedRecords: LinkedRecords;

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

  idToAttribute(id, serverState?): AbstractAttributeClient<any, any> | undefined {
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
      this.clientServerBus,
    );

    await attribute.create(value);

    if (facts) {
      await this.linkedRecords.Fact.createAll(facts.map(([p, o]) => [attribute.id, p, o]));
    }

    return attribute;
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

    params.append('query', JSON.stringify(query, (_, v) => {
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
    }));

    const result = await this.linkedRecords.fetch(`/attributes?${params.toString()}`);
    const records = await result.json();

    const attributeResult = {} as any;

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

  // async findAllAsValue<T extends CompoundAttributeQuery>(query: T)
  //   : Promise<
  //   { [K in keyof T]: TransformQueryRecord<T[K]> }
  //   > {
  //   const compound = await this.findAll(query);

  //   const result = {};

  //   const entries = Object.entries(compound);

  //   for (let i = 0; i < entries.length; i += 1) {
  //     const compoundName = entries[i]![0];
  //     result[compoundName] = result[compoundName] || [];

  //     for (let j = 0; j < entries[i]![1].length; j += 1) {
  //       result[compoundName].push({
  //         meta: {
  //           id: entries[i]![1][j].id,
  //           attribute: entries[i]![1][j],
  //         },
  //         data: entries[i]![1][j].getValue(),
  //       });
  //     }
  //   }

  //   const promises = [];

  //   Object.values(result).forEach((records) => {
  //     records.forEach((record) => {
  //       promises.push(record.data);
  //     });
  //   });

  //   await Promise.all(promises);

  //   Object.values(result).forEach(async (records) => {
  //     records.forEach(async (record) => {
  //       record.data = await record.data;
  //     });
  //   });

  //   return result;
  // }
}
