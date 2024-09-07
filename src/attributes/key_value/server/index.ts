// eslint-disable-next-line @typescript-eslint/no-unused-vars
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
import IsAttributeStorage from '../../abstract/is_attribute_storage';
import AbstractAttributeServer from '../../abstract/abstract_attribute_server';
import SerializedChangeWithMetadata from '../../abstract/serialized_change_with_metadata';
import KeyValueChange from '../key_value_change';
import Fact from '../../../facts/server';

export default class KeyValueAttribute extends AbstractAttributeServer<
object,
KeyValueChange,
IsAttributeStorage
> {
  public static getDataTypePrefix(): string {
    return 'kv';
  }

  async create(value: object) : Promise<{ id: string }> {
    const createdByFact = new Fact(this.actorId, '$isAccountableFor', this.id, this.logger);
    await createdByFact.save(this.actorId);
    return this.storage.createAttribute(this.id, this.actorId, JSON.stringify(value));
  }

  async get(args?: { inAuthorizedContext?: boolean }) : Promise<{
    value: object,
    changeId: string,
    actorId: string,
    createdAt: number,
    updatedAt: number
  }> {
    const queryOptions = { maxChangeId: '2147483647', inAuthorizedContext: args?.inAuthorizedContext };

    const result = await this.storage.getAttributeLatestSnapshot(
      this.id,
      this.actorId,
      queryOptions,
    );

    return {
      value: JSON.parse(result.value),
      changeId: result.changeId,
      actorId: result.actorId,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  async set(value: object) : Promise<{ id: string, updatedAt: Date }> {
    return this.storage.insertAttributeSnapshot(this.id, this.actorId, JSON.stringify(value));
  }

  async change(
    changeWithMetadata: SerializedChangeWithMetadata<KeyValueChange>,
  ) : Promise<SerializedChangeWithMetadata<KeyValueChange>> {
    const currentValue = await this.get();
    const change = KeyValueChange.fromJSON(changeWithMetadata.change);
    const newValue = change.apply(currentValue.value);

    const updateResult = await this.set(newValue);

    return new SerializedChangeWithMetadata(
      changeWithMetadata.attributeId,
      changeWithMetadata.actorId,
      changeWithMetadata.clientId,
      KeyValueChange.fromJSON(changeWithMetadata.change, '2147483647'),
      updateResult.updatedAt,
    );
  }
}
