// eslint-disable-next-line @typescript-eslint/no-unused-vars
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
import IsAttributeStorage from '../../abstract/is_attribute_storage';
import AbstractAttributeServer from '../../abstract/abstract_attribute_server';
import SerializedChangeWithMetadata from '../../abstract/serialized_change_with_metadata';
import BlobChange from '../blob_change';
import Fact from '../../../facts/server';

export default class BlobAttribute extends AbstractAttributeServer<
Blob,
BlobChange,
IsAttributeStorage
> {
  public static getDataTypePrefix(): string {
    return 'bl';
  }

  async create(value: Blob) : Promise<{ id: string }> {
    const createdByFact = new Fact(this.id, 'wasCreatedBy', this.actorId);
    await createdByFact.save();

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
    const content = await this.storage.getAttributeLatestSnapshot(this.id, { maxChangeId: '2147483647' });
    const match = content.value.match(/^data:(.*?);base64,/);

    if (!match) {
      throw new Error('Attribute content seems not to be a blob type');
    }

    const mimetype = match[1];
    const data = Buffer.from(content.value.replace(/^data:(.*?);base64,/, ''), 'base64');

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
}