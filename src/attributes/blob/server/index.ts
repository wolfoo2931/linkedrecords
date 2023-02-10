// eslint-disable-next-line @typescript-eslint/no-unused-vars
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
import IsAttributeStorage from '../../abstract/is_attribute_storage';
import AbstractAttributeServer from '../../abstract/abstract_attribute_server';
import SerializedChangeWithMetadata from '../../abstract/serialized_change_with_metadata';
import BlobChange from '../blob_change';
import Fact from '../../../facts/server';

export default class BlobAttribute extends AbstractAttributeServer<
string,
BlobChange,
IsAttributeStorage
> {
  public static getDataTypePrefix(): string {
    return 'bl';
  }

  async create(value: string) : Promise<{ id: string }> {
    const createdByFact = new Fact(this.id, 'wasCreatedBy', this.actorId);
    await createdByFact.save();
    return this.storage.createAttribute(this.id, this.actorId, value);
  }

  async get() : Promise<{
    value: string,
    changeId: string,
    actorId: string,
    createdAt: number,
    updatedAt: number
  }> {
    return this.storage.getAttributeLatestSnapshot(this.id, { maxChangeId: '2147483647' });
  }

  async set(value: string) : Promise<{ id: string }> {
    return this.storage.insertAttributeSnapshot(this.id, this.actorId, value);
  }

  async change(
    changeWithMetadata: SerializedChangeWithMetadata<BlobChange>,
  ) : Promise<SerializedChangeWithMetadata<BlobChange>> {
    const insertResult = await this.storage.insertAttributeSnapshot(
      this.id,
      this.actorId,
      `data:${changeWithMetadata.change.value.type};base64,${Buffer.from(await changeWithMetadata.change.value.text()).toString('base64')}`,
    );

    return new SerializedChangeWithMetadata(
      changeWithMetadata.attributeId,
      changeWithMetadata.actorId,
      changeWithMetadata.clientId,
      new BlobChange(new Blob(), insertResult.id),
    );
  }
}
