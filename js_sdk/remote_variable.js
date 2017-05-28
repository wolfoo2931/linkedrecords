'use strict';

var Changeset = changesets.Changeset;

var Buffer = function() {
    this.value = null;
};

Buffer.prototype = {
    add: function(changeset, changeInTransmission) {
        this.value = !this.value ? changeset : this.value.merge(changeset);
        this.inFlightOp = this.inFlightOp || changeInTransmission;
    },

    // this function returns a transformed version of the foreignChange which
    // fits into the current client state. This is required because the client
    // could have some changes which has not been send to the server yet. So, the
    // server don't know about these changes and the changes comming from the server
    // would not fit into the client state.
    transformAgainst: function(foreignChange) {
        var c1, v2;

        if(!this.inFlightOp) return foreignChange;

        c2 = foreignChange.transformAgainst(this.inFlightOp, true);
        this.inFlightOp = this.inFlightOp.transformAgainst(foreignChange, false);

        // instead of using a bridge we use c2 to transform the
        // foreignChange (change from server) into the client state.
        c1 = c2.transformAgainst(this.value, true);

        // Once we have this inferred operation, c2, we can use it
        // to transform the buffer (b) "down" one step
        this.value = this.value.transformAgainst(c2, false);

        return c1;
    },

    clear: function() {
        this.value = null;
        this.inFlightOp = null;
    },

    getValue: function() {
        return this.value;
    }
};

var RemoveVariable = function (variableId, bayeuxClient, clientId, actorId) {
    this.variableId = variableId;
    this.diffEngine = new exports.diff_match_patch();
    this.bayeuxClient = bayeuxClient;
    this.observers = {change: []};
    this.buffer = new Buffer();

    // because the same user can be logged on two browsers/laptops, we need
    // a clientId and an actorId
    this.clientId = clientId;
    this.actorId = actorId;

    // The change sent to the server but not yet acknowledged.
    this.changeInTransmission;
};

RemoveVariable.prototype = {

    load: function(done) {
        var self = this;

        $.ajax({url: '/variables/' + this.variableId}).done((result) => {
            self.version = result.changeId;
            self.value = result.value;

            self.bayeuxClient.subscribe('/changes/variable/' + self.variableId, function(change) {
                if(change.clientId === self.clientId) {
                    self._processApproval(change);
                } else {
                    self._processForeignChange(change);
                }
            });

            self._notifyOnChangeObservers();
            done && done();
        });

        return self;
    },

    getValue: function() {
        return this.value;
    },

    setValue: function(newValue) {
        var changeset = Changeset.fromDiff(this.diffEngine.diff_main(this.value, newValue));

        if(this.changeInTransmission) {
            this.buffer.add(changeset, this.changeInTransmission);
        } else {
            this._transmitChange(changeset, this.version);
        }

        this.value = newValue;
    },

    on: function(eventType, observer) {
        this.observers[eventType].push(observer);
    },

    _notifyOnChangeObservers: function() {
        this.observers.change.forEach(function(callback) {
            callback();
        });
    },

    _processForeignChange: function(foreignChange) {
        var foreignChangeset  = Changeset.unpack(foreignChange.transformedClientChange),
            transformedForeignChange = this.buffer.transformAgainst(foreignChangeset);

        this.value = transformedForeignChange.apply(this.value);
        this.version = foreignChange.id
        this._notifyOnChangeObservers();
    },

    _processApproval: function(approval) {
        var bufferedChanges = this.buffer.getValue();
        this.changeInTransmission = null;
        this.version = approval.id;

        if(bufferedChanges) {
            this._transmitChange(bufferedChanges, approval.id);
            this.buffer.clear();
        }
    },

    _transmitChange: function(changeset, version) {
        this.changeInTransmission = {
            variableId: this.variableId,
            change: {
                changeset: changeset.pack(),
                parentVersion: version
            },
            actorId: this.actorId,
            clientId: this.clientId
        };

        this.bayeuxClient.publish('/uncommited/changes/variable/' + self.variableId, this.changeInTransmission);
    },
}
