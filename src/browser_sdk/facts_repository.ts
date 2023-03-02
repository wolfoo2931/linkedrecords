/* eslint-disable import/no-cycle */

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
    await this.linkedRecords.fetch('/facts', { method: 'DELETE', headers: {} });
  }

  async findAll(query: FactQuery | FactQuery[]): Promise<Fact[]> {
    if (Array.isArray(query)) {
      const result = await Promise.all(query.map((fq) => this.findAll(fq)));
      return result.flat();
    }

    const { subject, predicate, object } = query;

    const params = new URLSearchParams();

    if (subject) {
      params.append('subject', JSON.stringify(subject));
    }

    if (predicate) {
      params.append('predicate', JSON.stringify(predicate));
    }

    if (object) {
      params.append('object', JSON.stringify(object));
    }

    const response = await this.linkedRecords.fetch(`/facts?${params.toString()}`);

    const responseJson = await response.json();

    return responseJson.map((record) => new Fact(
      this.linkedRecords,
      record.subject,
      record.predicate,
      record.object,
    ));
  }
}
