'use strict';

import { LinkedRecords } from '../../../browser_sdk/index'
import { Changeset } from 'changesets';
import { diff_match_patch as DiffMatchPatch} from 'diff_match_patch';
import { v4 as uuid } from 'uuid';
import Faye from 'faye';

const diffEngine = new DiffMatchPatch();

export class LongTextAttribute {

    static readonly DATA_TYPE_NAME = 'longText';
    static readonly DATA_TYPE_PREFIX = 'l';

    linkedRecords: LinkedRecords;
    id?: string;
    actorId: string;
    clientId: string;
    serverURL: URL;
    bayeuxClient: any;
    observers: any[];
    buffer: Buffer;
    changeInTransmission: any;
    subscription: any | null;
    isInitialized: boolean;
    version: string;
    value: string;

    constructor(linkedRecords: LinkedRecords, id?: string) {
        this.id = id;
        this.linkedRecords = linkedRecords;
        this.serverURL = linkedRecords.serverURL;
        this.bayeuxClient = new Faye.Client(this.serverURL + 'bayeux');
        this.observers = [];
        this.buffer = new Buffer();

        // because the same user can be logged on two browsers/laptops, we need
        // a clientId and an actorId
        this.clientId = linkedRecords.clientId;
        this.actorId = linkedRecords.actorId;

        // The change sent to the server but not yet acknowledged.
        this.changeInTransmission;

        this.version = '0';
        this.value = '';
        this.subscription = null;
        this.isInitialized = false;
    }

    async create(value: string) {
        if(this.id) {
            throw `Cannot create attribute because it has an id assigned (${this.id})`
        }

        this.id = `${LongTextAttribute.DATA_TYPE_PREFIX}-${uuid()}`;

        const response = await fetch(`${this.linkedRecords.serverURL}attributes/${this.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                clientId: this.clientId,
                actorId: this.actorId,
                value: value
            })
        });

        if(response.status !== 200) {
            throw `Error creating attribute: ${await response.text()}`;
        }

        const responseBody = await response.json();
        await this.load(responseBody);
    }

    async get() : Promise<{ value: string, changeId: string, actorId: string }> {
        await this.load();

        return {
            value: this.value,
            changeId: this.version,
            actorId: this.actorId,
        };
    }

    async set(newValue: string) {
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

    private async load(serverState?) {
        if(this.isInitialized) {
            return;
        }

        if(!this.id) {
            throw `cannot load an attribute without id`;
        }

        this.isInitialized = true;

        const result = serverState || await fetch(`${this.serverURL}attributes/${this.id}`).then(result => result.json())

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
        this.observers.forEach(callback => {
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

        if(!this.id) {
            throw `change can not be transmitted because attribute does not has an id`;
        }

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