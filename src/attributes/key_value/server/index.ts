// eslint-disable-next-line @typescript-eslint/no-unused-vars
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
import IsAttributeStorage from '../../abstract/is_attribute_storage';
import AbstractAttributeServer from '../../abstract/abstract_attribute_server';
import SerializedChangeWithMetadata from '../../abstract/serialized_change_with_metadata';
import PsqlStorageWithHistory from '../../attribute_storage/psql_with_history';
import PsqlStorageWithoutHistory from '../../attribute_storage/psql';
import KeyValueChange from '../key_value_change';

import QueuedTasks, { IsQueue } from '../../../../lib/queued-tasks';
import Fact from '../../../facts/server';
import IsLogger from '../../../../lib/is_logger';

const queue: IsQueue = QueuedTasks.create();

export default class KeyValueAttribute extends AbstractAttributeServer<
object,
KeyValueChange,
IsAttributeStorage
> {
  public static getDataTypePrefix(): string {
    return 'kv';
  }

  public static async createAll(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    attr: [AbstractAttributeServer<any, any, any>, any][],
    storage: IsAttributeStorage,
  ): Promise<void> {
    if (!attr[0]) {
      throw new Error('invalid attribute data found when creating all attributes');
    }

    await Fact.saveAllWithoutAuthCheckAndSpecialTreatment(
      attr.map(([a]) => new Fact(a.actorId, '$isAccountableFor', a.id, a.logger)),
      attr[0][0].actorId,
      attr[0][0].logger,
    );

    await storage.createAllAttributes(attr.map((a) => ({
      attributeId: a[0].id,
      actorId: a[0].actorId,
      value: a[1],
    })));
  }

  async create(value: object) : Promise<{ id: string }> {
    await this.createAccountableFact();
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

  static async migrateAllFromHistoryAttributes(logger: IsLogger): Promise<void> {
    const noHistoryStorage = new PsqlStorageWithoutHistory(logger);

    const allAttributes = await noHistoryStorage.pgPool.query("select tablename from pg_tables where schemaname='public' and tablename LIKE 'var_kv_%';");

    const records = allAttributes.rows;

    // eslint-disable-next-line no-plusplus
    for (let index = 0; index < records.length; index++) {
      const { tablename } = records[index];

      const [, ...idParts] = tablename.split('_');
      const attributeId = idParts.join('-');
      const attributeGUID = attributeId.replace('kv-', '');

      // eslint-disable-next-line no-await-in-loop
      if (!await noHistoryStorage.pgPool.findAny(`SELECT * FROM kv_attributes WHERE id='${attributeGUID}'`)) {
        logger.info(`start migrating history attribute ${attributeId}`);
        // eslint-disable-next-line no-await-in-loop
        await this.migrateFromHistoryAttribute(attributeId, logger);
        logger.info(`migrated history attribute ${attributeId}`);

        // eslint-disable-next-line no-await-in-loop
        await noHistoryStorage.pgPool.query(`ALTER TABLE ${tablename} RENAME TO migrated_${tablename};`);
      } else {
        logger.info(`Skip migration of attribute ${attributeId}, already exists`);
      }
    }

    logger.info('migration of KV values done!');
  }

  static async migrateFromHistoryAttribute(attributeId: string, logger: IsLogger): Promise<void> {
    const noHistoryStorage = new PsqlStorageWithoutHistory(logger);
    try {
      const value = await this.getLatestValueFromHistoryStorage(attributeId, logger);

      await noHistoryStorage.createAttributeWithoutFactsCheck(
        attributeId,
        value.actorId,
        JSON.stringify(value.value),
      );
    } catch (ex: any) {
      if (!ex.message.match(/No Snapshot found for attribute/)) {
        throw ex;
      }
    }
  }

  private static async getLatestValueFromHistoryStorage(
    attributeId: string,
    logger: IsLogger,
  ) : Promise<{
      value: object,
      changeId: string,
      actorId: string,
      createdAt: number,
      updatedAt: number
    }> {
    const changeId = '2147483647';
    const historyStorage = new PsqlStorageWithHistory(logger);
    const queryOptions = { maxChangeId: changeId, inAuthorizedContext: true };
    const result = await historyStorage.getAttributeLatestSnapshot(
      attributeId,
      'db-migration',
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
      attributeId,
      'db-migration',
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
