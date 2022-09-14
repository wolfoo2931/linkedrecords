'use strict';

import { Changeset } from 'changesets';
import { diff_match_patch as DiffMatchPatch} from 'diff_match_patch';
import AbstractAttributeClient from '../../abstract/attribute_client';
import Buffer from './buffer';

const diffEngine = new DiffMatchPatch();

export class LongTextAttribute extends AbstractAttributeClient<string, any> {

    buffer: Buffer = new Buffer();
    changeInTransmission: any = null;

    public static getDataTypePrefix() : string {
        return 'l';
    }

    public static getDataTypeName() : string {
        return 'longText';
    }

    public getDataTypePrefix() : string {
        return 'l';
    }

    public getDataTypeName() : string {
        return 'longText';
    }

    public getDefaultValue() : string {
        return '';
    }

    protected async rawSet(newValue: string) {
        var changeset = Changeset.fromDiff(diffEngine.diff_main(this.value, newValue));

        this.change(changeset);
    }

    protected async rawChange(changeset) {
        this.value = changeset.apply(this.value);

        if(this.changeInTransmission) {
            this.buffer.add(changeset);
        } else {
            this.transmitChange(changeset, this.version);
        }
    }

    protected onLoad() {
        this.buffer.clear();
    }

    protected onServerMessage(change) {
        if(change.clientId === this.clientId) {
            this.processApproval(change);
        } else {
            this.processForeignChange(change);
        }
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

    protected transmitChange(changeset, version) {

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

        this.sendToServer(this.changeInTransmission)
    }
};