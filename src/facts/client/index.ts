// eslint-disable-next-line import/no-cycle
import LinkedRecords from '../../browser_sdk';

export default class Fact {
  serverURL: URL;

  subject: string;

  predicate: string;

  object: string;

  constructor(linkedRecords: LinkedRecords, subject: string, predicate: string, object: string) {
    this.serverURL = linkedRecords.serverURL;
    this.subject = subject;
    this.predicate = predicate;
    this.object = object;
  }

  async save() {
    await fetch(`${this.serverURL}facts`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: this.subject,
        predicate: this.predicate,
        object: this.object,
      }),
    });
  }
}
