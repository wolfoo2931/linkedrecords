/* eslint-disable import/no-cycle */
/* eslint-disable class-methods-use-this */
import FileType from 'file-type';
import assert from 'assert';
import AbstractAttributeServer from '../../abstract/abstract_attribute_server';
import SerializedChangeWithMetadata from '../../abstract/serialized_change_with_metadata';
import BlobChange from '../blob_change';
import IsLogger from '../../../../lib/is_logger';
import PsqlStorage from '../../attribute_storage/psql';
import S3Storage from '../../attribute_storage/s3';
import PgPoolWithLog from '../../../../lib/pg-log';

export default class BlobAttribute extends AbstractAttributeServer<
Blob,
BlobChange
> {
  storage: S3Storage | PsqlStorage;

  isS3Configured: boolean = S3Storage.isConfigurationAvailable();

  public static getDataTypePrefix(): string {
    return 'bl';
  }

  public static async copyFromPSQLToS3(logger: IsLogger) {
    if (process.env['S3_COPY_FROM_BL_ATTRIBUTE_TABLE'] !== 'true' || !S3Storage.isConfigurationAvailable()) {
      return;
    }

    const s3storage = new S3Storage(logger);
    const pgPool = new PgPoolWithLog(logger);
    const prefix = this.getDataTypePrefix();

    const data = await pgPool.query('SELECT id, actor_id, value FROM bl_attributes');

    logger.info(`copy ${data.rows.length} files to S3`);

    await Promise.all(
      data.rows.map(({ id, value, actor_id }) => s3storage.createAttributeWithoutFactsCheck(`${prefix}-${id}`, actor_id, value)),
    );

    logger.info('copy to S3 done!');
  }

  constructor(
    id: string,
    clientId: string,
    actorId: string,
    logger: IsLogger,
  ) {
    super(id, clientId, actorId, logger);

    this.storage = this.isS3Configured
      ? new S3Storage(logger)
      : new PsqlStorage(logger, 'bl');
  }

  async create(value: Blob) : Promise<{ id: string }> {
    await this.createAccountableFact();

    return this.storage.createAttribute(this.id, this.actorId, await this.marshal(value));
  }

  async getStorageRequiredForValue(value: Blob): Promise<number> {
    return value.size;
  }

  async getStorageRequiredForChange(
    change: SerializedChangeWithMetadata<BlobChange>,
  ): Promise<number> {
    return this.getStorageRequiredForValue(change.change.value);
  }

  async get() : Promise<{
    value: Blob,
    changeId: string,
    actorId: string,
    createdAt: number,
    updatedAt: number
  }> {
    const content = await this.storage.getAttributeLatestSnapshot(this.id, this.actorId, { maxChangeId: '2147483647' });

    return {
      ...content,
      value: await this.unmarshal(content.value),
    };
  }

  async set(value: Blob) : Promise<{ id: string }> {
    const content = await this.marshal(value);
    return this.storage.insertAttributeSnapshot(this.id, this.actorId, content);
  }

  async change(
    changeWithMetadata: SerializedChangeWithMetadata<BlobChange>,
  ) : Promise<SerializedChangeWithMetadata<BlobChange>> {
    const newValue = changeWithMetadata.change.value;
    const insertResult = await this.storage.insertAttributeSnapshot(
      this.id,
      this.actorId,
      await this.marshal(newValue),
    );

    return new SerializedChangeWithMetadata(
      changeWithMetadata.attributeId,
      changeWithMetadata.actorId,
      changeWithMetadata.clientId,
      new BlobChange(new Blob(), insertResult.id),
    );
  }

  private async marshal(value: Blob): Promise<string> {
    return `data:${value.type};base64,${Buffer.from(await value.arrayBuffer()).toString('base64')}`;

    // TODO: this does not work with the current implementation of S3Storage
    return this.isS3Configured
      ? value.text()
      : `data:${value.type};base64,${Buffer.from(await value.arrayBuffer()).toString('base64')}`;
  }

  private async unmarshal(value: string): Promise<Blob> {
    const match = value.match(/^data:(.*?);(.*?),/);
    let rawContent = value;
    let data;
    let mimetype;
    let encoding;

    if (match) {
      [, mimetype, encoding] = match;

      rawContent = value.replace(new RegExp(`^data:(.*?);${encoding},`), '');

      assert(mimetype, 'No mimetype detected for the given blob attribute');
      assert(encoding === 'base64' || encoding === 'utf8', 'No valid encoding detected for the given blob attribute');

      data = Buffer.from(rawContent, encoding);
    }

    if (!mimetype || mimetype === 'application/octet-stream') {
      try {
        const typeFromBinary = await FileType.fromBuffer(data);
        if (typeFromBinary && typeFromBinary.mime) {
          mimetype = typeFromBinary.mime;
        }
      } catch (ex) {
        this.logger.warn(`failed to determine mimetype for blob attribute with id: ${this.id}`);
      }
    }

    if (!data) {
      data = Buffer.from(value, 'utf8');
    }

    return new Blob([data], { type: mimetype });
  }
}
