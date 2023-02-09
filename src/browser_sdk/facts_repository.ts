import LinkedRecords from '.';
import Fact from '../facts/client';
import { FactQuery } from '../facts/fact_query';

export default class FactsRepository {
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

  async findAll(query: FactQuery | FactQuery[]): Promise<Fact[]> {
    if (Array.isArray(query)) {
      const result = await Promise.all(query.map((fq) => this.findAll(fq)));
      return result.flat();
    }

    const { subject, predicate, object } = query;

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