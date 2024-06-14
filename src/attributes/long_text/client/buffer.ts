import LongTextChange from '../long_text_change';

export default class ChangeBuffer {
  value?: LongTextChange;

  // this is the a2
  inFlightOp?: LongTextChange;

  init(inFlightOp: LongTextChange) {
    this.inFlightOp = inFlightOp;
  }

  add(changeset: LongTextChange): void {
    this.value = this.value ? this.value.merge(changeset) : changeset;
  }

  // this function returns a transformed version of the foreignChange which
  // fits into the current client state. This is required because the client
  // could have some changes which has not been send to the server yet. So, the
  // server don't know about these changes and the changes coming from the server
  // would not fit into the client state.
  transformAgainst(
    foreignChange: LongTextChange,
  ) : LongTextChange {
    if (!this.inFlightOp) {
      return foreignChange;
    }

    const c2 = foreignChange.transformAgainst(this.inFlightOp, true);
    this.inFlightOp = this.inFlightOp?.transformAgainst(foreignChange, false);

    if (!this.value) return c2;

    // transform the foreignChange (change from server) into the client state.
    const c1 = foreignChange.transformAgainst(this.bridge!, true);

    // "Once we have this inferred operation, c2, we can use it
    // to transform the buffer (b) "down" one step"
    this.value = this.value?.transformAgainst(c2, false);

    return c1;
  }

  get bridge(): LongTextChange | undefined {
    if (!this.inFlightOp) {
      return undefined;
    }

    if (!this.value) {
      return this.inFlightOp;
    }

    return this.inFlightOp.merge(this.value);
  }

  clear() {
    this.value = undefined;
    this.inFlightOp = undefined;
  }

  getValue(): LongTextChange | undefined {
    return this.value;
  }
}
