/* eslint-disable max-classes-per-file */
/* eslint-disable import/no-cycle */

import { v4 as uuid } from 'uuid';
import LongTextAttribute from '../attributes/long_text/client';
import KeyValueAttribute from '../attributes/key_value/client';
import ServerSideEvents, { IsSubscribable } from '../../lib/server-side-events/client';
import AbstractAttributeClient from '../attributes/abstract/abstract_attribute_client';
import IsSerializable from '../attributes/abstract/is_serializable';
import Fact from '../facts/client';

class AttributesRepository {
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

  async findAll(query: { [key: string]: string | string[][] })
    :Promise<{
      [key: string]: AbstractAttributeClient<any, any>[] | AbstractAttributeClient<any, any>
    }> {
    const result = {};
    const qEntries = Object.entries(query);
    const promises: Promise<any>[] = [];

    for (let j = 0; j < qEntries.length; j += 1) {
      const qEntry = qEntries[j];

      if (qEntry) {
        const n = qEntry[0];
        const q = qEntry[1];

        if (typeof q === 'string') {
          promises.push(this.find(q).then((attribute) => {
            result[n] = attribute;
          }).catch(() => {
            result[n] = null;
          }));
        } else {
          result[n] = [];
          promises.push(this.linkedRecords.Fact.findAll({ subject: q }).then((facts) => {
            for (let i = 0; i < facts.length; i += 1) {
              const subjectId = facts[i]?.subject;
              if (subjectId && !result[n].find((attr) => attr.id === subjectId)) {
                const AttributeClass = AttributesRepository.attributeTypes
                  .find((at) => at.isAttributeId(subjectId));

                if (AttributeClass) {
                  const attribute = new AttributeClass(
                    this.linkedRecords,
                    this.serverSideEvents,
                    subjectId,
                  );

                  result[n].push(attribute);
                }
              }
            }
          }));
        }
      }
    }

    await Promise.all(promises);

    return result;
  }
}

class FactsRepository {
  linkedRecords: LinkedRecords;

  constructor(linkedRecords: LinkedRecords) {
    this.linkedRecords = linkedRecords;
  }

  async create(subjectId?: string, predicateId?: string, objectId?: string): Promise<Fact> {
    if (!subjectId) {
      throw Error('subjectId can not be null');
    }

    if (!objectId) {
      throw Error('objectId can not be null');
    }

    if (!predicateId) {
      throw Error('predicateId can not be null');
    }

    const fact = new Fact(this.linkedRecords, subjectId, predicateId, objectId);
    await fact.save();
    return fact;
  }

  async deleteAll() {
    await fetch(`${this.linkedRecords.serverURL}facts`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  async findAll({ subject, predicate, object }:
  { subject?: (string | string[])[],
    predicate?: string[],
    object?: (string | string[])[] }): Promise<Fact[]> {
    const queryURL = new URL(`${this.linkedRecords.serverURL}facts`);

    if (subject) {
      queryURL.searchParams.append('subject', JSON.stringify(subject));
    }

    if (predicate) {
      queryURL.searchParams.append('predicate', JSON.stringify(predicate));
    }

    if (object) {
      queryURL.searchParams.append('object', JSON.stringify(object));
    }

    const response = await fetch(queryURL, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    const responseJson = await response.json();

    return responseJson.map((record) => new Fact(
      this.linkedRecords,
      record.subject,
      record.predicate,
      record.object,
    ));
  }
}

export default class LinkedRecords {
  serverSideEvents: IsSubscribable;

  serverURL: URL;

  clientId: string;

  actorId: string;

  Attribute: AttributesRepository;

  Fact: FactsRepository;

  constructor(serverURL: URL, serverSideEvents?: IsSubscribable) {
    this.serverURL = serverURL;
    this.actorId = uuid();
    this.clientId = uuid();
    this.serverSideEvents = serverSideEvents || new ServerSideEvents();
    this.Attribute = new AttributesRepository(this, this.serverSideEvents);
    this.Fact = new FactsRepository(this);
  }
}
