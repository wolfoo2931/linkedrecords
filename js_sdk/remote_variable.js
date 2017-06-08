'use strict';

var Changeset = require('changesets').Changeset,
    diffMatchPatch = require('diff_match_patch'),
    diffEngine = new diffMatchPatch.diff_match_patch,
    popsicle = require('popsicle');

var Buffer = function() {
    this.value = null;
    this.inFlightOp = null;
};

Buffer.prototype = {
    add: function(changeset) {
        this.value = !this.value ? changeset : this.value.merge(changeset);
    },

    // this function returns a transformed version of the foreignChange which
    // fits into the current client state. This is required because the client
    // could have some changes which has not been send to the server yet. So, the
    // server don't know about these changes and the changes comming from the server
    // would not fit into the client state.
    transformAgainst: function(foreignChange, changeInTransmission) {
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
    },

    clear: function() {
        this.value = null;
        this.inFlightOp = null;
    },

    getValue: function() {
        return this.value;
    }
};

var RemoteVariable = function (variableId, bayeuxClient, clientId, actorId) {
    this.variableId = variableId;
    this.bayeuxClient = bayeuxClient;
    this.observers = [];
    this.buffer = new Buffer();

    // because the same user can be logged on two browsers/laptops, we need
    // a clientId and an actorId
    this.clientId = clientId;
    this.actorId = actorId;

    // The change sent to the server but not yet acknowledged.
    this.changeInTransmission;
};

RemoteVariable.prototype = {

    load: function(done) {
        var self = this;

        popsicle.get('http://localhost:3000/variables/' + this.variableId).then((result) => {
            result = JSON.parse(result.body);
            self.version = result.changeId;
            self.value = result.value;
            self.buffer.clear();
            self._notifySubscribers();
            done && done();
        });

        self.subscription = self.subscription || self.bayeuxClient.subscribe('/changes/variable/' + self.variableId, (change) => {
            if(change.clientId === self.clientId) {
                self._processApproval(change);
            } else {
                self._processForeignChange(change);
            }
        });

        return self;
    },

    getValue: function() {
        return this.value;
    },

    setValue: function(newValue, callback) {
        var changeset = Changeset.fromDiff(diffEngine.diff_main(this.value, newValue));

        if(this.changeInTransmission) {
            this.buffer.add(changeset);
        } else {
            this._transmitChange(changeset, this.version);
        }

        this.value = newValue;
    },

    subscribe: function(observer) {
        this.observers.push(observer);
    },

    _notifySubscribers: function() {
        this.observers.forEach(function(callback) {
            callback();
        });
    },

    _processForeignChange: function(foreignChange) {
        try {
            var foreignChangeset  = Changeset.unpack(foreignChange.transformedClientChange);
            var transformedForeignChange = this.buffer.transformAgainst(foreignChangeset, this.changeInTransmission);
            this.value = transformedForeignChange.apply(this.value);
            this.version = foreignChange.id;
            this._notifySubscribers();
        } catch(ex) {
            console.log('ERROR: processing foreign change failed (probably because of a previous message loss). Reload server state to recover.');
            this.load();
        }
    },

    _processApproval: function(approval) {
        var bufferedChanges = this.buffer.getValue();
        this.changeInTransmission = null;
        this.version = approval.id;
        this.buffer.clear();

        if(bufferedChanges) {
            this._transmitChange(bufferedChanges, approval.id);
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

        this.bayeuxClient.publish('/uncommited/changes/variable/' + this.variableId, this.changeInTransmission);
    }
};

module.exports = RemoteVariable;
