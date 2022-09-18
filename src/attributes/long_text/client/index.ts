'use strict';

import AbstractAttributeClient from '../../abstract/attribute_client';
import LongTextChange from '../long_text_change';
import Buffer from './buffer';

export class LongTextAttribute extends AbstractAttributeClient<string, LongTextChange> {

    buffer: Buffer = new Buffer();
    changeInTransmission: any = null;

    public static getDataTypePrefix() : string {
        return 'l';
    }

    public static getDataTypeName() : string {
        return 'longText';
    }

    public getDataTypePrefix() : string {
        return LongTextAttribute.getDataTypePrefix();
    }

    public getDataTypeName() : string {
        return LongTextAttribute.getDataTypeName();
    }

    public getDefaultValue() : string {
        return '';
    }

    protected async rawSet(newValue: string) {
        var changeset = LongTextChange.fromDiff(this.value, newValue);

        this.change(changeset);
    }

    protected async rawChange(changeset: LongTextChange) {
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

    protected onServerMessage(changeWithMetadata) {
        if(changeWithMetadata.clientId === this.clientId) {
            this.processApproval(changeWithMetadata);
        } else {
            this.processForeignChange(changeWithMetadata);
        }
    }

    private processForeignChange(foreignChangeWithMetadata) {
        try {
            var foreignChangeset = LongTextChange.fromString(foreignChangeWithMetadata.transformedClientChange);
            var transformedForeignChange = this.buffer.transformAgainst(foreignChangeset, this.changeInTransmission);
            this.value = transformedForeignChange.apply(this.value);
            this.version = foreignChangeWithMetadata.id;
            this.notifySubscribers(transformedForeignChange, foreignChangeWithMetadata);
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

    protected transmitChange(changeset: LongTextChange, version: string) {

        if(!this.id) {
            throw `change can not be transmitted because attribute does not has an id`;
        }

        this.changeInTransmission = {
            id: this.id,
            change: {
                changeset: changeset.toString(),
                parentVersion: version
            },
            actorId: this.actorId,
            clientId: this.clientId
        };

        this.sendToServer(this.changeInTransmission)
    }
};