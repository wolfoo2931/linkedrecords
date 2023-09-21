/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable import/no-cycle */
/* eslint-disable class-methods-use-this */
import flatten, { unflatten } from 'flat';
import AbstractAttributeClient from '../../abstract/abstract_attribute_client';
import SerializedChangeWithMetadata from '../../abstract/serialized_change_with_metadata';
import KeyValueChange, { AtomicChange } from '../key_value_change';
import getAllPrefixes from '../../../../lib/utils/all_prefixes';
import get from 'get-value';

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

  public deserializeValue(serializedValue: string) : Promise<object> {
    return Promise.resolve(unflatten(JSON.parse(serializedValue)));
  }

  protected async rawSet(newValue: object) {
    let changes: AtomicChange[] = [];
    const flatOldValue = flatten(this.value) as object;
    const flatValue = flatten(newValue) as object;

    Object.entries(flatOldValue).forEach(([key]) => {
      // in case keys are not present in newValue anymore,
      // we want to remove them from the key value store.
      // flatOldValue.split('.').
      getAllPrefixes(key.split('.')).forEach((path) => {
        changes.push({ key: path.join('.'), value: null });
      });
    });

    changes = changes.filter(({ key }) => (
      get(newValue, key) === null || get(newValue, key) === undefined));

    Object.entries(flatValue).forEach(([key, value]) => {
      // We transmit the key value pair only if it actually changed
      if (flatOldValue[key] !== value) {
        changes.push({ key, value });
      }
    });

    if (changes.length) {
      await this.change(new KeyValueChange(changes));
    }
  }

  protected async rawChange(change: KeyValueChange) {
    const actualChanges = change.change.filter(({ key, value }) => {
      if (!this.value[key] && value) {
        return true;
      }

      if (this.value[key] && !value) {
        return true;
      }

      return JSON.stringify(this.value[key]) !== JSON.stringify(value);
    });

    if (actualChanges.length === 0) {
      return;
    }

    this.transmitChange(new KeyValueChange(actualChanges, this.version));
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
