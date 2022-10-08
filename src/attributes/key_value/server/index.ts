// eslint-disable-next-line @typescript-eslint/no-unused-vars
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
import IsAttributeStorage from '../../abstract/is_attribute_storage';
import AbstractAttributeServer from '../../abstract/abstract_attribute_server';
import SerializedChangeWithMetadata from '../../abstract/serialized_change_with_metadata';
import KeyValueChange from '../key_value_change';

export default class KeyValueAttribute extends AbstractAttributeServer<
object,
KeyValueChange,
IsAttributeStorage
> {
  public static getDataTypePrefix(): string {
    return 'kv';
  }

  async create(value: object) : Promise<{ id: string }> {
    return this.storage.createAttribute(this.id, this.actorId, JSON.stringify(value));
  }

  async get() : Promise<{ value: object, changeId: string, actorId: string }> {
    return this.getByChangeId('2147483647');
  }

  async set(value: object) : Promise<{ id: string }> {
    return this.storage.insertAttributeSnapshot(this.id, this.actorId, JSON.stringify(value));
  }

  async change(
    changeWithMetadata: SerializedChangeWithMetadata<KeyValueChange>,
  ) : Promise<SerializedChangeWithMetadata<KeyValueChange>> {
    const changeId = await this.storage.insertAttributeChange(
      this.id,
      this.actorId,
      JSON.stringify(changeWithMetadata.change),
    );

    return new SerializedChangeWithMetadata(
      changeWithMetadata.attributeId,
      changeWithMetadata.actorId,
      changeWithMetadata.clientId,
      KeyValueChange.fromJSON(changeWithMetadata.change, changeId),
    );
  }

  private async getByChangeId(
    changeId: string,
  ) : Promise<{ value: object, changeId: string, actorId: string }> {
    const queryOptions = { maxChangeId: changeId };
    const result = await this.storage.getAttributeLatestSnapshot(this.id, queryOptions);

    const commulatedResult = {
      value: JSON.parse(result.value),
      changeId: result.changeId,
      actorId: result.actorId,
    };

    const changes = await this.storage.getAttributeChanges(this.id, queryOptions);

    changes.forEach((change) => {
      const tmpChange = KeyValueChange.fromString(change.value);
      commulatedResult.value = tmpChange.apply(commulatedResult.value);
      commulatedResult.changeId = change.changeId;
      commulatedResult.actorId = change.actorId;
    });

    return commulatedResult;
  }
}
