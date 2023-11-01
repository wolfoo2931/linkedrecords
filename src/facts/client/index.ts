// eslint-disable-next-line import/no-cycle
import LinkedRecords from '../../browser_sdk';

export default class Fact {
  linkedRecords: LinkedRecords;

  subject: string;

  predicate: string;

  object: string;

  constructor(linkedRecords: LinkedRecords, subject: string, predicate: string, object: string) {
    this.linkedRecords = linkedRecords;
    this.subject = subject;
    this.predicate = predicate;
    this.object = object;
  }

  toJSON() {
    return {
      subject: this.subject,
      predicate: this.predicate,
      object: this.object,
    };
  }

  async save() {
    await this.linkedRecords.fetch('/facts', {
      method: 'POST',
      body: JSON.stringify({
        subject: this.subject,
        predicate: this.predicate,
        object: this.object,
      }),
    });
  }
}
