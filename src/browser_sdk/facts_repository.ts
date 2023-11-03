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
    const response = await this.linkedRecords.fetch('/facts', {
      method: 'POST',
      body: JSON.stringify(facts),
    });

    if (!response) {
      return [];
    }

    const createdRawFacts = await response.json();

    return createdRawFacts.map((rawFact) => new Fact(
      this.linkedRecords,
      rawFact.subject,
      rawFact.predicate,
      rawFact.object,
    ));
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

  async deleteAll(facts: [ string, string, string ][]): Promise<void> {
    await this.linkedRecords.fetch('/facts/delete', {
      method: 'POST',
      body: JSON.stringify(facts),
    });
  }
}
