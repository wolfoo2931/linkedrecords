export type AtomicChange = {
  key: string,
  value: string | null,
};

export default class KeyValueChange {
  public changeId: string;

  public change: AtomicChange[];

  public static fromJSON(input: any, changeId?: string) {
    return new KeyValueChange(input as AtomicChange[], changeId);
  }

  public static fromString(input: string) : KeyValueChange {
    return new KeyValueChange(JSON.parse(input));
  }

  constructor(changeset: AtomicChange[], changeId?: string) {
    this.changeId = changeId ?? 'uncommited';
    this.change = changeset;
  }

  public toString(): string {
    return JSON.stringify(this.change);
  }

  public toJSON(): object {
    return this.change;
  }

  public apply(input: object): object {
    const result = JSON.parse(JSON.stringify(input));

    this.change.forEach((aChange) => {
      if (aChange.value === null) {
        delete result[aChange.key];
      } else {
        result[aChange.key] = aChange.value;
      }
    });

    return result;
  }

  public merge(other: KeyValueChange): KeyValueChange {
    let mergedChanges: AtomicChange[] = [];

    this.change.forEach((ch) => {
      mergedChanges = mergedChanges.filter((x) => x.key !== ch.key);
      mergedChanges.push(ch);
    });

    other.change.forEach((ch) => {
      mergedChanges = mergedChanges.filter((x) => x.key !== ch.key);
      mergedChanges.push(ch);
    });

    return new KeyValueChange(mergedChanges);
  }
}