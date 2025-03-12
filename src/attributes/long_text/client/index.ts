/* eslint-disable import/no-cycle */
/* eslint-disable class-methods-use-this */

import AbstractAttributeClient from '../../abstract/abstract_attribute_client';
import SerializedChangeWithMetadata from '../../abstract/serialized_change_with_metadata';
import LongTextChange from '../long_text_change';
import ChangeBuffer from './buffer';

export default class LongTextAttribute extends AbstractAttributeClient<string, LongTextChange> {
  buffer: ChangeBuffer = new ChangeBuffer();

  changeInTransmission?: SerializedChangeWithMetadata<LongTextChange> = undefined;

  changeInTransmissionSendAt?: Date = undefined;

  public static serverApprovalTimeoutInMS: number = 2500;

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
    return LongTextAttribute.getDataTypeName();
  }

  public getDefaultValue() : string {
    return '';
  }

  public deserializeValue(serializedValue: string) : Promise<string> {
    return Promise.resolve(serializedValue);
  }

  protected async rawSet(newValue: string) {
    const changeset = LongTextChange.fromDiff(this.value, newValue);

    await this.change(changeset);
  }

  protected async rawChange(changeset: LongTextChange): Promise<boolean> {
    // TODO: Check for version is valid
    // if (this.version === '0') {
    //   throw Error('Cannot change attribute as attributed state is not loaded from server!');
    // }

    this.value = changeset.apply(this.value);

    if (this.changeInTransmission) {
      if (
        this.getLastChangeTransmittedMillisecondsAgo() > LongTextAttribute.serverApprovalTimeoutInMS
      ) {
        this.linkedRecords.handleConnectionError(new Error(`No approval received from server after ${LongTextAttribute.serverApprovalTimeoutInMS} ms`));
      }

      this.buffer.add(changeset);
    } else {
      const success = await this.transmitChange(
        new LongTextChange(changeset.changeset, this.version),
      );

      if (!success) {
        return false;
      }
    }

    this.notifySubscribers(changeset);

    return true;
  }

  protected getLastChangeTransmittedMillisecondsAgo(): number {
    if (!this.changeInTransmissionSendAt) {
      return -1;
    }

    return (new Date()).getTime() - this.changeInTransmissionSendAt.getTime();
  }

  protected onLoad() {
    this.changeInTransmission = undefined;
    this.changeInTransmissionSendAt = undefined;
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
    let transformedForeignChange;
    let foreignChangeset;

    try {
      foreignChangeset = LongTextChange.fromString(
        foreignChangeWithMetadata.change.changeset,
      );

      transformedForeignChange = this.buffer.transformAgainst(
        foreignChangeset,
      );

      this.value = transformedForeignChange.apply(this.value);
      this.version = foreignChangeWithMetadata.change.changeId;
      this.notifySubscribers(transformedForeignChange, foreignChangeWithMetadata);
    } catch (ex) {
      // eslint-disable-next-line no-console
      console.log(this.value);
      // eslint-disable-next-line no-console
      console.log(transformedForeignChange?.changeset?.inspect());
      // eslint-disable-next-line no-console
      console.log('ERROR: processing foreign change failed (probably because of a previous message loss). Reload server state to recover.', ex);
      this.buffer.clear();
      this.load(undefined, true);
    }
  }

  private processApproval(approval: SerializedChangeWithMetadata<LongTextChange>) {
    const bufferedChanges = this.buffer.getValue();
    this.changeInTransmission = undefined;
    this.changeInTransmissionSendAt = undefined;
    this.version = approval.change.changeId;
    this.buffer.clear();

    if (bufferedChanges) {
      this.transmitChange(new LongTextChange(bufferedChanges.changeset, approval.change.changeId));
    }
  }

  protected transmitChange(changeset: LongTextChange): Promise<boolean> {
    if (!this.id) {
      throw new Error('change can not be transmitted because attribute does not has an id');
    }

    if (!this.actorId) {
      throw new Error('actorId is unknown, can not transmit change!');
    }

    this.changeInTransmissionSendAt = new Date();
    this.changeInTransmission = new SerializedChangeWithMetadata<LongTextChange>(
      this.id,
      this.actorId,
      this.clientId,
      changeset,
    );

    this.buffer.init(changeset);

    return this.sendToServer(this.changeInTransmission);
  }
}
