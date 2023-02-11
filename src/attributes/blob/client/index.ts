/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable import/no-cycle */
/* eslint-disable class-methods-use-this */
import AbstractAttributeClient from '../../abstract/abstract_attribute_client';
import SerializedChangeWithMetadata from '../../abstract/serialized_change_with_metadata';
import BlobChange from '../blob_change';

export default class KeyValueAttribute extends AbstractAttributeClient<Blob, BlobChange> {
  public static getDataTypePrefix() : string {
    return 'bl';
  }

  public static getDataTypeName() : string {
    return 'blob';
  }

  public getDataTypePrefix() : string {
    return KeyValueAttribute.getDataTypePrefix();
  }

  public getDataTypeName() : string {
    return KeyValueAttribute.getDataTypeName();
  }

  public getDefaultValue() : Blob {
    return new Blob();
  }

  public async deserializeValue(serializedValue: string) : Promise<Blob> {
    return new Blob([serializedValue]);
  }

  protected getCreatePayload(value: Blob) {
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

  protected async rawChange(change: BlobChange) {
    this.rawSet(change.value);
  }

  protected onServerMessage(changeWithMetadata: SerializedChangeWithMetadata<BlobChange>) {
    if (changeWithMetadata.clientId !== this.clientId) {
      this.notifySubscribers(changeWithMetadata.change, changeWithMetadata);
    }
  }

  protected async transmitChange(value: Blob) {
    if (!this.id) {
      throw new Error('change can not be transmitted because attribute does not has an id');
    }

    const formData = new FormData();
    const url = `${this.serverURL}attributes/${this.id}?clientId=${this.clientId}&actorId=${this.actorId}`;

    formData.append('change', value, 'blob');
    formData.append('attributeId', this.id);
    formData.append('actorId', this.actorId);
    formData.append('clientId', this.clientId);

    const response = await this.withConnectionLostHandler(() => fetch(url, {
      method: 'PATCH',
      body: formData,
      credentials: 'include',
    }));

    if (response.status === 401) {
      this.linkedRecords.handleExpiredLoginSession();
    }
  }

  protected onLoad() {}
}
