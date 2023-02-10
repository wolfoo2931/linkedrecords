export default class BlobChange {
  value: Blob;

  changeId: string;

  constructor(newValue: Blob, changeId?: string) {
    this.changeId = changeId ?? 'uncommited';
    this.value = newValue;
  }

  // eslint-disable-next-line class-methods-use-this
  toJSON(): object {
    return { updated: true };
  }
}
