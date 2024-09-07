import IsLogger from '../../../lib/is_logger';
import IsAttributeStorage from '../abstract/is_attribute_storage';
import { AttributeSnapshot, AttributeChange, AttributeChangeCriteria } from './types';

/* eslint-disable import/prefer-default-export */
import PsqlStorageWithHistory from './psql_with_history';
import PsqlStorage from './psql';

export default class AttributeStorage implements IsAttributeStorage {
  pgStorageWithHistory: IsAttributeStorage;

  pgStorage: PsqlStorage;

  constructor(logger: IsLogger) {
    this.pgStorageWithHistory = new PsqlStorageWithHistory(logger);
    this.pgStorage = new PsqlStorage(logger);
  }

  private getStorage(attributeId): IsAttributeStorage {
    const [type] = attributeId.split('-');

    if (type === 'kv' || type === 'bl') {
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
}
