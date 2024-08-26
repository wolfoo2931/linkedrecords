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
    return this.getByChangeId('2147483647', args);
  }

  async set(value: object) : Promise<{ id: string }> {
    return this.storage.insertAttributeSnapshot(this.id, this.actorId, JSON.stringify(value));
  }

  async change(
    changeWithMetadata: SerializedChangeWithMetadata<KeyValueChange>,
  ) : Promise<SerializedChangeWithMetadata<KeyValueChange>> {
    const insertResult = await this.storage.insertAttributeChange(
      this.id,
      this.actorId,
      JSON.stringify(changeWithMetadata.change),
    );

    return new SerializedChangeWithMetadata(
      changeWithMetadata.attributeId,
      changeWithMetadata.actorId,
      changeWithMetadata.clientId,
      KeyValueChange.fromJSON(changeWithMetadata.change, insertResult.id),
      insertResult.updatedAt,
    );
  }

  private async getByChangeId(
    changeId: string,
    args?: { inAuthorizedContext?: boolean },
  ) : Promise<{
      value: object,
      changeId: string,
      actorId: string,
      createdAt: number,
      updatedAt: number
    }> {
    const queryOptions = { maxChangeId: changeId, inAuthorizedContext: args?.inAuthorizedContext };
    const result = await this.storage.getAttributeLatestSnapshot(
      this.id,
      this.actorId,
      queryOptions,
    );

    const accumulatedResult = {
      value: JSON.parse(result.value),
      changeId: result.changeId,
      actorId: result.actorId,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };

    if (accumulatedResult.changeId === changeId) {
      return accumulatedResult;
    }

    const changes = await this.storage.getAttributeChanges(
      this.id,
      this.actorId,
      {
        ...queryOptions,
        minChangeId: result.changeId,
      },
    );

    if (changes.length && changes[0].changeId === result.changeId) {
      changes.shift();
    }

    changes.forEach((change) => {
      const tmpChange = KeyValueChange.fromString(change.value);
      accumulatedResult.value = tmpChange.apply(accumulatedResult.value);
      accumulatedResult.changeId = change.changeId;
      accumulatedResult.actorId = change.actorId;
      accumulatedResult.updatedAt = change.time;
    });

    if (changes.length >= 100) {
      await this.storage.insertAttributeSnapshot(
        this.id,
        this.actorId,
        JSON.stringify(accumulatedResult.value),
        accumulatedResult.changeId,
      );
    }

    return accumulatedResult;
  }
}
