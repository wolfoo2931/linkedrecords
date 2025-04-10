/* eslint-disable import/no-cycle */
/* eslint-disable class-methods-use-this */
import FileType from 'file-type';
import assert from 'assert';
import IsAttributeStorage from '../../abstract/is_attribute_storage';
import AbstractAttributeServer from '../../abstract/abstract_attribute_server';
import SerializedChangeWithMetadata from '../../abstract/serialized_change_with_metadata';
import BlobChange from '../blob_change';
import IsLogger from '../../../../lib/is_logger';
import AttributeStorage from '../../attribute_storage/psql';

export default class BlobAttribute extends AbstractAttributeServer<
Blob,
BlobChange
> {
  storage: IsAttributeStorage;

  public static getDataTypePrefix(): string {
    return 'bl';
  }

  constructor(
    id: string,
    clientId: string,
    actorId: string,
    logger: IsLogger,
  ) {
    super(id, clientId, actorId, logger);
    this.storage = new AttributeStorage(logger, 'bl');
  }

  async create(value: Blob) : Promise<{ id: string }> {
    const encoding = 'base64';
    await this.createAccountableFact();

    const content = `data:${value.type};${encoding},${Buffer.from(await value.arrayBuffer()).toString(encoding)}`;
    return this.storage.createAttribute(this.id, this.actorId, content);
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
    const match = content.value.match(/^data:(.*?);(.*?),/);

    if (!match) {
      throw new Error('Attribute content seems not to be a blob type');
    }

    const encoding = match[2];
    let mimetype = match[1];

    assert(mimetype, 'No mimetype detected for the given blob attribute');
    assert(encoding === 'base64' || encoding === 'utf8', 'No valid encoding detected for the given blob attribute');

    const data = Buffer.from(content.value.replace(new RegExp(`^data:(.*?);${encoding},`), ''), encoding);

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
    const content = `data:${value.type};utf-8,${await value.text()}`;
    return this.storage.insertAttributeSnapshot(this.id, this.actorId, content);
  }

  async change(
    changeWithMetadata: SerializedChangeWithMetadata<BlobChange>,
  ) : Promise<SerializedChangeWithMetadata<BlobChange>> {
    const newValue = changeWithMetadata.change.value;
    const insertResult = await this.storage.insertAttributeSnapshot(
      this.id,
      this.actorId,
      `data:${newValue.type};utf-8,${await newValue.text()}`,
    );

    return new SerializedChangeWithMetadata(
      changeWithMetadata.attributeId,
      changeWithMetadata.actorId,
      changeWithMetadata.clientId,
      new BlobChange(new Blob(), insertResult.id),
    );
  }
}
