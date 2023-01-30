/* eslint-disable max-classes-per-file */
/* eslint-disable import/no-cycle */

import { v4 as uuid } from 'uuid';
import intersect from 'intersect';
import Cookies from 'js-cookie';
import LongTextAttribute from '../attributes/long_text/client';
import KeyValueAttribute from '../attributes/key_value/client';
import KeyValueChange from '../attributes/key_value/key_value_change';
import LongTextChange from '../attributes/long_text/long_text_change';
import ServerSideEvents, { IsSubscribable } from '../../lib/server-side-events/client';
import AbstractAttributeClient from '../attributes/abstract/abstract_attribute_client';
import IsSerializable from '../attributes/abstract/is_serializable';
import Fact from '../facts/client';

export {
  LongTextAttribute,
  KeyValueAttribute,
  KeyValueChange,
  LongTextChange,
};

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

class FactsRepository {
  linkedRecords: LinkedRecords;

  constructor(linkedRecords: LinkedRecords) {
    this.linkedRecords = linkedRecords;
  }

  async createAll(facts: [ string?, string?, string? ][]):
  Promise<Fact[]> {
    const createdFacts = await Promise.all(
      facts.map((attr) => this.create(
        attr[0],
        attr[1],
        attr[2],
      )),
    );

    return createdFacts;
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
      credentials: 'include',
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
      credentials: 'include',
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

  loginURL?: URL;

  clientId: string;

  actorId: string;

  Attribute: AttributesRepository;

  Fact: FactsRepository;

  constructor(serverURL: URL, serverSideEvents?: IsSubscribable, loginURL?: URL) {
    this.serverURL = serverURL;
    this.loginURL = loginURL;
    this.actorId = LinkedRecords.readUserIdFromCookies();
    this.clientId = uuid();
    this.serverSideEvents = serverSideEvents || new ServerSideEvents();
    this.Attribute = new AttributesRepository(this, this.serverSideEvents);
    this.Fact = new FactsRepository(this);
  }

  static readUserIdFromCookies() {
    const cookieValue = Cookies.get('userId');

    if (!cookieValue) {
      return undefined;
    }

    const withoutSignature = cookieValue.slice(0, cookieValue.lastIndexOf('.'));
    const split = withoutSignature.split(':');
    const userId = split.length === 1 ? split[0] : split[1];

    return userId;
  }
}
