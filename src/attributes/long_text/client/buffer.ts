import { Changeset } from 'changesets';

export default class Buffer {

    value: any;
    inFlightOp: any;

    constructor() {
        this.value = null;
        this.inFlightOp = null;
    }

    add(changeset) {
        this.value = !this.value ? changeset : this.value.merge(changeset);
    }

    // this function returns a transformed version of the foreignChange which
    // fits into the current client state. This is required because the client
    // could have some changes which has not been send to the server yet. So, the
    // server don't know about these changes and the changes comming from the server
    // would not fit into the client state.
    transformAgainst(foreignChange, changeInTransmission) {
        var c1, c2;

        if(!changeInTransmission) {
            return foreignChange;
        }

        this.inFlightOp = this.inFlightOp || Changeset.unpack(changeInTransmission.change.changeset);

        c2 = foreignChange.transformAgainst(this.inFlightOp, true);
        this.inFlightOp = this.inFlightOp.transformAgainst(foreignChange, false);

        if(!this.getValue()) return c2;

        // instead of using a bridge we use c2 to transform the
        // foreignChange (change from server) into the client state.
        c1 = c2.transformAgainst(this.value, true);

        // "Once we have this inferred operation, c2, we can use it
        // to transform the buffer (b) "down" one step"
        this.value = this.value.transformAgainst(c2, false);

        return c1;
    }

    clear() {
        this.value = null;
        this.inFlightOp = null;
    }

    getValue() {
        return this.value;
    }
};