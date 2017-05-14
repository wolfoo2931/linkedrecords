'use strict';

var Changeset = changesets.Changeset;

// because the same user can be logged on two browsers/laptops, we need
// a clientId and an actorId
var RemoveVariable = function (variableId, bayeuxClient, clientId, actorId) {
    this.variableId = variableId;
    this.diffEngine = new exports.diff_match_patch();
    this.sendBuffer = [];
    this.receiveBuffer = [];
    this.bayeuxClient = bayeuxClient;
    this.clientId = clientId;
    this.actorId = actorId;
    this.observers = {
        change: []
    };

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
            } catch (ex) {}
        }
    },

    _processApproval: function(change) {
        this.value = Changeset.unpack(change.transformedServerChange).apply(this.value);
        this.parentVersion = change.id;
        this.changeInTransmission = null;
        this.notifyOnChangeObservers(change.transformedServerChange);
    },

    // As it is only allowed to sent one change to the server at a time
    // the returned changeset of this method includes all local changes made
    // while the change is in transmission.
    _composedSendBuffer: function() {
        var clonedBuffer = this.sendBuffer.slice(0),
            composedCS = clonedBuffer.shift();

        clonedBuffer.forEach(function(change) {
            composedCS = composedCS.transformAgainst(change);
        });

        return composedCS;
    },

    getValue: function() {
        return this.value;
    },

    // Update the content on the local client, buffer
    // and propagate the change to the server (execute whenever the user
    // performs some input on the document)
    setValue: function(tmpValue) {

        //tmpValue = tmpValue.replace(/<div>/gi, '').replace(/<\/div>/gi, '');

        var diff = this.diffEngine.diff_main(this.value, tmpValue),
            changeset = Changeset.fromDiff(diff);

        if(this.changeInTransmission) {
            this.sendBuffer.push(changeset);
        } else {
            this.changeInTransmission = {
                variableId: this.variableId,
                change: {
                    changeset: changeset.pack(),
                    parentVersion: this.parentVersion
                },
                actorId: this.actorId,
                clientId: this.clientId
            };

            this.value = changeset.apply(this.value);

            this.bayeuxClient.publish('/uncommited/changes/variable/' + self.variableId, this.changeInTransmission);
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
