/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable import/no-cycle */
/* eslint-disable class-methods-use-this */
import AbstractAttributeClient from '../../abstract/abstract_attribute_client';
import SerializedChangeWithMetadata from '../../abstract/serialized_change_with_metadata';
import BlobChange from '../blob_change';

export default class BlobAttribute extends AbstractAttributeClient<Blob, BlobChange> {
  public static getDataTypePrefix() : string {
    return 'bl';
  }

  public static getDataTypeName() : string {
    return 'blob';
  }

  public getDataTypePrefix() : string {
    return BlobAttribute.getDataTypePrefix();
  }

  public getDataTypeName() : string {
    return BlobAttribute.getDataTypeName();
  }

  public getDefaultValue() : Blob {
    return new Blob();
  }

  public async deserializeValue(serializedValue: string) : Promise<Blob> {
    return new Blob([serializedValue]);
  }

  protected getCreatePayload(value: Blob) {
    if (!this.actorId) {
      throw new Error('actorId is unknown, can not create blob payload!');
    }

    const formData = new FormData();
    formData.append('change', value, 'blob');
    formData.append('actorId', this.actorId);
    formData.append('clientId', this.clientId);

    return formData;
  }

  protected async rawSet(newValue: Blob) {
    this.value = newValue;
    this.transmitChange(this.value);
  }

  protected async rawChange(change: BlobChange): Promise<boolean> {
    this.value = change.value;
    return this.transmitChange(this.value);
  }

  protected onServerMessage(changeWithMetadata: SerializedChangeWithMetadata<BlobChange>) {
    if (changeWithMetadata.clientId !== this.clientId) {
      this.notifySubscribers(changeWithMetadata.change, changeWithMetadata);
    }
  }

  protected async transmitChange(value: Blob): Promise<boolean> {
    if (!this.id) {
      throw new Error('change can not be transmitted because attribute does not has an id');
    }

    if (!this.actorId) {
      throw new Error('actorId is unknown, can not transmit change!');
    }

    const formData = new FormData();
    const url = `/attributes/${this.id}?clientId=${this.clientId}&actorId=${this.actorId}`;

    formData.append('change', value, 'blob');
    formData.append('attributeId', this.id);
    formData.append('actorId', this.actorId);
    formData.append('clientId', this.clientId);

    const success = await this.linkedRecords.fetch(url, {
      method: 'PATCH',
      body: formData,
      isJSON: false,
      doNotHandleExpiredSessions: true,
    });

    return !!success;
  }

  protected onLoad() {}
}
