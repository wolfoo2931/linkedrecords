'use strict';

var Changeset = changesets.Changeset;

// because the same user can be logged on two browsers/laptops, we need
// a clientId and an actorId
var RemoveVariable = function (variableId, bayeuxClient, clientId, actorId) {
    this.variableId = variableId;
    this.diffEngine = new exports.diff_match_patch();
    this.bayeuxClient = bayeuxClient;
    this.clientId = clientId;
    this.actorId = actorId;
    this.observers = {
        change: []
    };

    this.receiveBuffer = [];

    // The change sent to the server but not yet acknowledged.
    this.changeInTransmission;
}

RemoveVariable.prototype = {

    load: function(done) {
        var self = this;

        $.ajax({url: 'http://localhost:3000/variables/' + this.variableId}).done((result) => {
            self.parentVersion = result.changeId;
            self.value = result.value;

            self.bayeuxClient.subscribe('/changes/variable/' + self.variableId, function(change) {
                if(change.clientId === self.clientId) {
                    self._processApproval(change);
                } else {
                    self._processForeignChange(change);
                }
            });

            self.notifyOnChangeObservers();
            done && done();
        });

        return self;
    },

    _processForeignChange: function(change) {
        if(this.changeInTransmission) {
            this.receiveBuffer.push(change);
        } else {
            try {
                this.value = Changeset.unpack(change.transformedClientChange).apply(this.value);
                this.parentVersion = change.id;
                this.notifyOnChangeObservers(change.transformedClientChange);
            } catch (ex) { console.log('failed to apply foreign change; local parentVersion: ' + this.parentVersion + ', change version: ' + change.id); }
        }
    },

    _processApproval: function(change) {
        this.parentVersion = change.id;
        this.changeInTransmission = null;
        this.value = Changeset.unpack(change.transformedServerChange).apply(this.value);
        this.notifyOnChangeObservers(change.transformedServerChange);
    },

    _transmitChangeset: function(changeset, parentVersion) {
        this.changeInTransmission = {
            variableId: this.variableId,
            change: {
                changeset: changeset.pack(),
                parentVersion: parentVersion
            },
            actorId: this.actorId,
            clientId: this.clientId
        };

        this.bayeuxClient.publish('/uncommited/changes/variable/' + self.variableId, this.changeInTransmission);
    },

    _getChangesetBetweenValues: function(value1, value2) {
        return Changeset.fromDiff(this.diffEngine.diff_main(value1, value2))
    },

    getValue: function() {
        return this.value;
    },

    setValue: function(newValue) {

        var changeset = this._getChangesetBetweenValues(this.value, newValue);

        if(this.changeInTransmission) {
            this.sendBuffer = changeset;
        } else {
            this._transmitChangeset(changeset, this.parentVersion);
            this.value = newValue;
        }
    },

    on: function(eventType, observer) {
        this.observers[eventType].push(observer);
    },

    notifyOnChangeObservers: function(changeset) {
        this.observers.change.forEach(function(observer) {
            observer(changeset);
        });
    }
}
