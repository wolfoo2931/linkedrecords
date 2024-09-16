// eslint-disable-next-line @typescript-eslint/no-unused-vars
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
import FileType from 'file-type';
import IsAttributeStorage from '../../abstract/is_attribute_storage';
import AbstractAttributeServer from '../../abstract/abstract_attribute_server';
import SerializedChangeWithMetadata from '../../abstract/serialized_change_with_metadata';
import BlobChange from '../blob_change';
import PsqlStorageWithHistory from '../../attribute_storage/psql_with_history';
import PsqlStorageWithoutHistory from '../../attribute_storage/psql';
import IsLogger from '../../../../lib/is_logger';

export default class BlobAttribute extends AbstractAttributeServer<
Blob,
BlobChange,
IsAttributeStorage
> {
  public static getDataTypePrefix(): string {
    return 'bl';
  }

  async create(value: Blob) : Promise<{ id: string }> {
    await this.createAccountableFact();

    const content = `data:${value.type};base64,${Buffer.from(await value.arrayBuffer()).toString('base64')}`;
    return this.storage.createAttribute(this.id, this.actorId, content);
  }

  async get() : Promise<{
    value: Blob,
    changeId: string,
    actorId: string,
    createdAt: number,
    updatedAt: number
  }> {
    const content = await this.storage.getAttributeLatestSnapshot(this.id, this.actorId, { maxChangeId: '2147483647' });
    const match = content.value.match(/^data:(.*?);base64,/);

    if (!match) {
      throw new Error('Attribute content seems not to be a blob type');
    }

    let mimetype = match[1];
    const data = Buffer.from(content.value.replace(/^data:(.*?);base64,/, ''), 'base64');

    if (mimetype === 'application/octet-stream') {
      try {
        const typeFromBinary = await FileType.fromBuffer(data);
        if (typeFromBinary && typeFromBinary.mime) {
          mimetype = typeFromBinary.mime;
        }
      } catch (ex) {
        this.logger.warn(`failed to determine mimetype for blob attribute with id: ${this.id}`);
      }
    }

    return {
      ...content,
      value: new Blob([data], { type: mimetype }),
    };
  }

  async set(value: Blob) : Promise<{ id: string }> {
    const content = `data:${value.type};base64,${Buffer.from(await value.arrayBuffer()).toString('base64')}`;
    return this.storage.insertAttributeSnapshot(this.id, this.actorId, content);
  }

  async change(
    changeWithMetadata: SerializedChangeWithMetadata<BlobChange>,
  ) : Promise<SerializedChangeWithMetadata<BlobChange>> {
    const insertResult = await this.storage.insertAttributeSnapshot(
      this.id,
      this.actorId,
      `data:${changeWithMetadata.change.value.type};base64,${Buffer.from(await changeWithMetadata.change.value.arrayBuffer()).toString('base64')}`,
    );

    return new SerializedChangeWithMetadata(
      changeWithMetadata.attributeId,
      changeWithMetadata.actorId,
      changeWithMetadata.clientId,
      new BlobChange(new Blob(), insertResult.id),
    );
  }

  static async migrateAllFromHistoryAttributes(logger: IsLogger): Promise<void> {
    const noHistoryStorage = new PsqlStorageWithoutHistory(logger);

    const allAttributes = await noHistoryStorage.pgPool.query("select tablename from pg_tables where schemaname='public' and tablename LIKE 'var_bl_%';");

    const records = allAttributes.rows;

    // eslint-disable-next-line no-plusplus
    for (let index = 0; index < records.length; index++) {
      const { tablename } = records[index];

      const [, ...idParts] = tablename.split('_');
      const attributeId = idParts.join('-');
      const attributeGUID = attributeId.replace('bl-', '');

      // eslint-disable-next-line no-await-in-loop
      if (!await noHistoryStorage.pgPool.findAny(`SELECT * FROM bl_attributes WHERE id='${attributeGUID}'`)) {
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

    logger.info('migration of Blob values done!');
  }

  static async migrateFromHistoryAttribute(attributeId: string, logger: IsLogger): Promise<void> {
    const noHistoryStorage = new PsqlStorageWithoutHistory(logger);
    try {
      const value = await this.getLatestValueFromHistoryStorage(attributeId, logger);

      await noHistoryStorage.createAttributeWithoutFactsCheck(
        attributeId,
        value.actorId,
        value.value,
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
      value: string,
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
      value: result.value,
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
      accumulatedResult.value = change.value;
      accumulatedResult.changeId = change.changeId;
      accumulatedResult.actorId = change.actorId;
      accumulatedResult.updatedAt = change.time;
    });

    return accumulatedResult;
  }
}
