/* eslint-disable import/no-cycle */
/* eslint-disable class-methods-use-this */

import AbstractAttributeClient from '../../abstract/abstract_attribute_client';
import SerializedChangeWithMetadata from '../../abstract/serialized_change_with_metadata';
import LongTextChange from '../long_text_change';
import ChangeBuffer from './buffer';

export default class LongTextAttribute extends AbstractAttributeClient<string, LongTextChange> {
  buffer: ChangeBuffer = new ChangeBuffer();

  changeInTransmission?: SerializedChangeWithMetadata<LongTextChange> = undefined;

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
    const changeset = LongTextChange.fromDiff(this.value, newValue);

    this.change(changeset);
  }

  protected async rawChange(changeset: LongTextChange) {
    this.value = changeset.apply(this.value);

    if (this.changeInTransmission) {
      this.buffer.add(changeset);
    } else {
      this.transmitChange(new LongTextChange(changeset.changeset, this.version));
    }
  }

  protected onLoad() {
    this.buffer.clear();
  }

  protected onServerMessage(changeWithMetadata: SerializedChangeWithMetadata<LongTextChange>) {
    if (changeWithMetadata.clientId === this.clientId) {
      this.processApproval(changeWithMetadata);
    } else {
      this.processForeignChange(changeWithMetadata);
    }
  }

  private processForeignChange(
    foreignChangeWithMetadata: SerializedChangeWithMetadata<LongTextChange>,
  ) {
    try {
      const foreignChangeset = LongTextChange.fromString(
        foreignChangeWithMetadata.change.changeset,
      );

      const transformedForeignChange = this.buffer.transformAgainst(
        foreignChangeset,
        this.changeInTransmission?.change,
      );

      this.value = transformedForeignChange.apply(this.value);
      this.version = foreignChangeWithMetadata.change.changeId;
      this.notifySubscribers(transformedForeignChange, foreignChangeWithMetadata);
    } catch (ex) {
      console.log('ERROR: processing foreign change failed (probably because of a previous message loss). Reload server state to recover.', ex);
      this.load();
    }
  }

  private processApproval(approval: SerializedChangeWithMetadata<LongTextChange>) {
    const bufferedChanges = this.buffer.getValue();
    this.changeInTransmission = undefined;
    this.version = approval.change.changeId;
    this.buffer.clear();

    if (bufferedChanges) {
      this.transmitChange(new LongTextChange(bufferedChanges.changeset, approval.change.changeId));
    }
  }

  protected transmitChange(changeset: LongTextChange) {
    if (!this.id) {
      throw new Error('change can not be transmitted because attribute does not has an id');
    }

    this.changeInTransmission = new SerializedChangeWithMetadata<LongTextChange>(
      this.id,
      this.actorId,
      this.clientId,
      changeset,
    );

    this.sendToServer(this.changeInTransmission);
  }
}
