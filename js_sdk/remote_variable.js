'use strict';

var Changeset = require('changesets').Changeset,
    diffMatchPatch = require('diff_match_patch'),
    diffEngine = new diffMatchPatch.diff_match_patch,
    Faye = require('faye');

class Buffer {
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
}

class RemoteVariable {
    constructor(variableId, serverURL, clientId, actorId) {
        this.variableId = variableId;
        this.serverURL = serverURL;
        this.bayeuxClient = new Faye.Client(serverURL + '/bayeux');
        this.observers = [];
        this.buffer = new Buffer();

        // because the same user can be logged on two browsers/laptops, we need
        // a clientId and an actorId
        this.clientId = clientId;
        this.actorId = actorId;

        // The change sent to the server but not yet acknowledged.
        this.changeInTransmission;
    }

    async load() {
        const result = await fetch(`${this.serverURL}/variables/${this.variableId}`).then(result => result.json())

        this.version = result.changeId;
        this.value = result.value;
        this.buffer.clear();
        this._notifySubscribers();

        this.subscription = this.subscription || this.bayeuxClient.subscribe('/changes/variable/' + this.variableId, (change) => {
            if(change.clientId === this.clientId) {
                this._processApproval(change);
            } else {
                this._processForeignChange(change);
            }
        });
    }

    getValue() {
        return this.value;
    }

    setValue(newValue) {

        if(newValue === this.value) {
            return;
        }

        var changeset  = Changeset.fromDiff(diffEngine.diff_main(this.value, newValue));

        if(this.changeInTransmission) {
            this.buffer.add(changeset);
        } else {
            this._transmitChange(changeset, this.version);
        }

        this.value = newValue;
    }

    subscribe(observer) {
        this.observers.push(observer);
    }

    _notifySubscribers(change) {
        this.observers.forEach(function(callback) {
            callback(change);
        });
    }

    _processForeignChange(foreignChange) {
        try {
            var foreignChangeset  = Changeset.unpack(foreignChange.transformedClientChange);
            var transformedForeignChange = this.buffer.transformAgainst(foreignChangeset, this.changeInTransmission);
            this.value = transformedForeignChange.apply(this.value);
            this.version = foreignChange.id;
            this._notifySubscribers(transformedForeignChange);
        } catch(ex) {
            console.log('ERROR: processing foreign change failed (probably because of a previous message loss). Reload server state to recover.');
            this.load();
        }
    }

    _processApproval(approval) {
        var bufferedChanges = this.buffer.getValue();
        this.changeInTransmission = null;
        this.version = approval.id;
        this.buffer.clear();

        if(bufferedChanges) {
            this._transmitChange(bufferedChanges, approval.id);
        }
    }

    _transmitChange(changeset, version) {
        this.changeInTransmission = {
            variableId: this.variableId,
            change: {
                changeset: changeset.pack(),
                parentVersion: version
            },
            actorId: this.actorId,
            clientId: this.clientId
        };

        this.bayeuxClient.publish('/uncommited/changes/variable/' + this.variableId, this.changeInTransmission);
    }
};

module.exports = RemoteVariable;
