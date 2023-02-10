/* eslint-disable import/no-cycle */

import intersect from 'intersect';
import LinkedRecords from '.';
import AbstractAttributeClient from '../attributes/abstract/abstract_attribute_client';
import IsSerializable from '../attributes/abstract/is_serializable';
import LongTextAttribute from '../attributes/long_text/client';
import KeyValueAttribute from '../attributes/key_value/client';
import BlobAttribute from '../attributes/blob/client';
import { IsSubscribable } from '../../lib/server-side-events/client';

export default class AttributesRepository {
  linkedRecords: LinkedRecords;

  private serverSideEvents: IsSubscribable;

  private static attributeTypes = [
    LongTextAttribute,
    KeyValueAttribute,
    BlobAttribute,
  ];

  constructor(linkedRecords: LinkedRecords, serverSideEvents: IsSubscribable) {
    this.linkedRecords = linkedRecords;
    this.serverSideEvents = serverSideEvents;
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
  // TODO: rename to findComposition
  async findAll(query: { [key: string]: string | string[][] })
    :Promise<{
      [key: string]: AbstractAttributeClient<any, any>[] | AbstractAttributeClient<any, any>
    }> {
    const result = {};
    const qEntries = Object.entries(query);

    for (let j = 0; j < qEntries.length; j += 1) {
      const qEntry = qEntries[j];

      if (qEntry) {
        const n = qEntry[0];
        const q = qEntry[1];

        // todo: fix await in loop
        // eslint-disable-next-line no-await-in-loop
        result[n] = await this.findAllFromSameGroup(q);
      }
    }

    return result;
  }

  private async findAllFromSameGroup(query: string | string[][]) {
    if (typeof query === 'string') {
      try {
        return await this.find(query);
      } catch (ex) {
        return null;
      }
    }

    if (query.find((q) => (!q[0] && !q[1] && !q[2]))) {
      return [];
    }

    const subjectFactsQuery = {
      subject: query
        .map((x) => ((x.length === 3 && x[0] === '$it') ? [x[1] as string, x[2] as string] : x))
        .filter((x) => x.length === 2),
    };

    const factsWhereItIsTheSubject = await this.linkedRecords.Fact.findAll(subjectFactsQuery);
    let matchedIds = factsWhereItIsTheSubject.map((f) => f.subject);

    const objectFactsQuery = query
      .filter((q) => q.length === 3 && q[2] === '$it')
      .map(([subject, predicate]) => ({
        subject: [subject as string],
        predicate: [predicate as string],
      }));

    if (objectFactsQuery.length !== 0) {
      const factsWhereItIsTheObject = await Promise.all(
        objectFactsQuery.map((q) => this.linkedRecords.Fact.findAll(q)),
      );

      const matchedObjectIds = factsWhereItIsTheObject.flat().map((f) => f.object);

      matchedIds = intersect(matchedIds, matchedObjectIds);
    }

    return this.idArrayToAttributes(matchedIds);
  }

  private idArrayToAttributes(ids: string[]) {
    return ids.filter((value, index, self) => self.indexOf(value) === index)
      .map((id) => {
        const AttributeClass = AttributesRepository.attributeTypes
          .find((at) => at.isAttributeId(id));

        if (AttributeClass) {
          const attribute = new AttributeClass(
            this.linkedRecords,
            this.serverSideEvents,
            id,
          );

          return attribute;
        }

        return undefined;
      })
      .filter((attr) => attr);
  }
}
