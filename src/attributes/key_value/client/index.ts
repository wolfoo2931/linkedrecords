/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable import/no-cycle */
/* eslint-disable class-methods-use-this */
import flatten, { unflatten } from 'flat';
import AbstractAttributeClient from '../../abstract/abstract_attribute_client';
import SerializedChangeWithMetadata from '../../abstract/serialized_change_with_metadata';
import KeyValueChange, { AtomicChange } from '../key_value_change';

export default class KeyValueAttribute extends AbstractAttributeClient<object, KeyValueChange> {
  public static getDataTypePrefix() : string {
    return 'kv';
  }

  public static getDataTypeName() : string {
    return 'keyValue';
  }

  public getDataTypePrefix() : string {
    return KeyValueAttribute.getDataTypePrefix();
  }

  public getDataTypeName() : string {
    return KeyValueAttribute.getDataTypeName();
  }

  public getDefaultValue() : object {
    return {};
  }

  public deserializeValue(serializedValue: string) : object {
    return unflatten(JSON.parse(serializedValue));
  }

  protected async rawSet(newValue: object) {
    let changes: AtomicChange[] = [];
    const flatValue = flatten(newValue) as object;

    Object.entries(this.value).forEach(([key]) => {
      changes.push({ key, value: null });
    });

    Object.entries(flatValue).forEach(([key, value]) => {
      changes = changes.filter((ch) => ch.key !== key);
      changes.push({ key, value });
    });

    this.change(new KeyValueChange(changes));
  }

  protected async rawChange(change: KeyValueChange) {
    this.transmitChange(new KeyValueChange(change.change, this.version));
    this.value = change.apply(this.value);
  }

  protected onLoad() {
  }

  protected onServerMessage(changeWithMetadata: SerializedChangeWithMetadata<KeyValueChange>) {
    const change = new KeyValueChange(
      changeWithMetadata.change as unknown as AtomicChange[],
      changeWithMetadata.change.changeId,
    );

    if (changeWithMetadata.clientId === this.clientId) {
      return;
    }

    this.value = change.apply(this.value);
    this.version = change.changeId;

    this.notifySubscribers(change, changeWithMetadata);
  }

  protected transmitChange(changeset: KeyValueChange) {
    if (!this.id) {
      throw new Error('change can not be transmitted because attribute does not has an id');
    }

    this.sendToServer(new SerializedChangeWithMetadata<KeyValueChange>(
      this.id,
      this.actorId,
      this.clientId,
      changeset,
    ));
  }
}
