import IsLogger from '../../../lib/is_logger';
import IsAttributeStorage from '../abstract/is_attribute_storage';
import { AttributeSnapshot, AttributeChange, AttributeChangeCriteria } from './types';

/* eslint-disable import/prefer-default-export */
import PsqlStorageWithHistory from './psql_with_history';
import PsqlStorage from './psql';
import S3Storage from './s3';

export default class AttributeStorage implements IsAttributeStorage {
  pgStorageWithHistory: IsAttributeStorage;

  pgStorage: IsAttributeStorage;

  s3Storage: IsAttributeStorage;

  constructor(logger: IsLogger) {
    this.pgStorageWithHistory = new PsqlStorageWithHistory(logger);
    this.pgStorage = new PsqlStorage(logger);
    this.s3Storage = process.env['S3_ENDPOINT']
      ? new S3Storage(logger)
      : this.pgStorage;
  }

  getStorage(attributeId): IsAttributeStorage {
    const [type] = attributeId.split('-');

    if (type === 'bl') {
      return this.s3Storage;
    }

    if (type === 'kv') {
      return this.pgStorage;
    }

    return this.pgStorageWithHistory;
  }

  insertAttributeSnapshot(
    attributeId: string,
    actorId: string,
    value: string,
    changeId?: string,
  ): Promise<{ id: string, updatedAt: Date }> {
    return this
      .getStorage(attributeId)
      .insertAttributeSnapshot(attributeId, actorId, value, changeId);
  }

  createAttributeWithoutFactsCheck(
    attributeId: string,
    actorId: string,
    value: string,
  ) : Promise<{ id: string }> {
    return this
      .getStorage(attributeId)
      .createAttributeWithoutFactsCheck(attributeId, actorId, value);
  }

  async createAllAttributes(
    attr: { attributeId: string, actorId: string, value: string }[],
  ) : Promise<{ id: string }[]> {
    const attributesWithHistory: { attributeId: string, actorId: string, value: string }[] = [];
    const attributesWithoutHistory: { attributeId: string, actorId: string, value: string }[] = [];

    attr.forEach((a) => {
      const storage = this.getStorage(a.attributeId);

      if (storage === this.pgStorageWithHistory) {
        attributesWithHistory.push(a);
      } else {
        attributesWithoutHistory.push(a);
      }
    });

    return Promise.all([
      ...(await this.pgStorageWithHistory.createAllAttributes(attributesWithHistory)),
      ...(await this.pgStorage.createAllAttributes(attributesWithoutHistory)),
    ]);
  }

  createAttribute(
    attributeId: string,
    actorId: string,
    value: string,
  ) : Promise<{ id: string }> {
    return this
      .getStorage(attributeId)
      .createAttribute(attributeId, actorId, value);
  }

  getAttributeLatestSnapshot(
    attributeId: string,
    actorId: string,
    criteria: AttributeChangeCriteria,
  ) : Promise<AttributeSnapshot> {
    return this
      .getStorage(attributeId)
      .getAttributeLatestSnapshot(attributeId, actorId, criteria);
  }

  getAttributeChanges(
    attributeId: string,
    actorId: string,
    criteria: AttributeChangeCriteria,
  ) : Promise<Array<any>> {
    return this
      .getStorage(attributeId)
      .getAttributeChanges(attributeId, actorId, criteria);
  }

  insertAttributeChange(
    attributeId: string,
    actorId: string,
    change: string,
  ) : Promise<AttributeChange> {
    return this
      .getStorage(attributeId)
      .insertAttributeChange(attributeId, actorId, change);
  }

  async getSizeInBytesForAllAttributes(nodes: string[]): Promise<number> {
    const storageDrivers = [
      this.pgStorageWithHistory,
      this.pgStorage,
    ];

    const sizes = await Promise.all(storageDrivers.map(
      (s) => s.getSizeInBytesForAllAttributes(nodes),
    ));

    return sizes.reduce((acc, curr) => acc + curr, 0);
  }
}
