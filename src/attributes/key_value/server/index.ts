// eslint-disable-next-line @typescript-eslint/no-unused-vars
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
import IsAttributeStorage from '../../abstract/is_attribute_storage';
import AbstractAttributeServer from '../../abstract/abstract_attribute_server';
import SerializedChangeWithMetadata from '../../abstract/serialized_change_with_metadata';
import PsqlStorageWithHistory from '../../attribute_storage/psql_with_history';
import KeyValueChange from '../key_value_change';
import Fact from '../../../facts/server';

import QueuedTasks, { IsQueue } from '../../../../lib/queued-tasks';

const queue: IsQueue = QueuedTasks.create();

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

    const result = await this.retryWithMigration(() => this.storage.getAttributeLatestSnapshot(
      this.id,
      this.actorId,
      queryOptions,
    ));

    return {
      value: JSON.parse(result.value),
      changeId: result.changeId,
      actorId: result.actorId,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  async set(value: object) : Promise<{ id: string, updatedAt: Date }> {
    return this.retryWithMigration(
      () => this.storage.insertAttributeSnapshot(this.id, this.actorId, JSON.stringify(value)),
    );
  }

  async change(
    changeWithMetadata: SerializedChangeWithMetadata<KeyValueChange>,
  ) : Promise<SerializedChangeWithMetadata<KeyValueChange>> {
    return queue
      .do(this.id, async () => {
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
      });
  }

  private async retryWithMigration<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const result = await fn();
      return result;
    } catch (ex: any) {
      if (!ex.message.startsWith('Attribute not found')) {
        throw ex;
      }

      await this.migrateFromHistoryAttribute();

      const result = await fn();
      return result;
    }
  }

  private async migrateFromHistoryAttribute(): Promise<void> {
    const value = await this.getLatestValueFromHistoryStorage();
    await this.storage.createAttributeWithoutFactsCheck(
      this.id,
      this.actorId,
      JSON.stringify(value.value),
    );
  }

  private async getLatestValueFromHistoryStorage() : Promise<{
    value: object,
    changeId: string,
    actorId: string,
    createdAt: number,
    updatedAt: number
  }> {
    const changeId = '2147483647';
    const historyStorage = new PsqlStorageWithHistory(this.logger);
    const queryOptions = { maxChangeId: changeId };
    const result = await historyStorage.getAttributeLatestSnapshot(
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

    const changes = await historyStorage.getAttributeChanges(
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

    return accumulatedResult;
  }
}
