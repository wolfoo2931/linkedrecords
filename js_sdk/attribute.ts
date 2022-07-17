'use strict';

import { Changeset } from 'changesets';
import { diff_match_patch as DiffMatchPatch} from 'diff_match_patch';
import Faye from 'faye';

const diffEngine = new DiffMatchPatch();

export class Attribute {

    id: string;
    actorId: string;
    clientId: string;
    serverURL: string;
    bayeuxClient: any;
    observers: any[];
    buffer: Buffer;
    changeInTransmission: any;
    subscription: any | null;
    isInitialized: boolean;

    version: number | null;
    value: string | null;

    constructor(id, clientId, actorId, serverURL) {
        this.id = id;
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

        this.version = null;
        this.value = null;
        this.subscription = null;
        this.isInitialized = false;
    }

    async get() {
        await this.load();

        return this.value;
    }

    async set(newValue) {
        await this.load();

        if(newValue === this.value) {
            return;
        }

        var changeset = Changeset.fromDiff(diffEngine.diff_main(this.value, newValue));

        this.change(changeset);
    }

    async change(changeset) {
        await this.load();

        this.value = changeset.apply(this.value);

        if(this.changeInTransmission) {
            this.buffer.add(changeset);
        } else {
            this.transmitChange(changeset, this.version);
        }
    }

    async subscribe(observer) {
        await this.load();

        this.observers.push(observer);
    }

    private async load() {
        if(this.isInitialized) {
            return;
        }

        this.isInitialized = true;

        const result = await fetch(`${this.serverURL}/attributes/${this.id}`).then(result => result.json())

        this.version = result.changeId;
        this.value = result.value;
        this.buffer.clear();
        this.notifySubscribers(undefined, undefined);

        this.subscription = this.subscription || this.bayeuxClient.subscribe('/changes/attribute/' + this.id, (change) => {
            if(change.clientId === this.clientId) {
                this.processApproval(change);
            } else {
                this.processForeignChange(change);
            }
        });
    }

    private notifySubscribers(change, fullChangeInfo) {
        this.observers.forEach(function(callback) {
            callback(change, fullChangeInfo);
        });
    }

    private processForeignChange(foreignChange) {
        try {
            var foreignChangeset  = Changeset.unpack(foreignChange.transformedClientChange);
            var transformedForeignChange = this.buffer.transformAgainst(foreignChangeset, this.changeInTransmission);
            this.value = transformedForeignChange.apply(this.value);
            this.version = foreignChange.id;
            this.notifySubscribers(transformedForeignChange, foreignChange);
        } catch(ex) {
            console.log('ERROR: processing foreign change failed (probably because of a previous message loss). Reload server state to recover.', ex);
            this.load();
        }
    }

    private processApproval(approval) {
        var bufferedChanges = this.buffer.getValue();
        this.changeInTransmission = null;
        this.version = approval.id;
        this.buffer.clear();

        if(bufferedChanges) {
            this.transmitChange(bufferedChanges, approval.id);
        }
    }

    private transmitChange(changeset, version) {
        this.changeInTransmission = {
            id: this.id,
            change: {
                changeset: changeset.pack(),
                parentVersion: version
            },
            actorId: this.actorId,
            clientId: this.clientId
        };

        this.bayeuxClient.publish('/uncommited/changes/attribute/' + this.id, this.changeInTransmission);
    }
};

class Buffer {

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