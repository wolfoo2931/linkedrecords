import IsLogger from '../../../lib/is_logger';
import IsAttributeStorage from '../abstract/is_attribute_storage';
import { AttributeSnapshot, AttributeChange, AttributeChangeCriteria } from './types';

/* eslint-disable import/prefer-default-export */
import PsqlStorageWithHistory from './psql_with_history';

export default class AttributeStorage implements IsAttributeStorage {
  pgStorageWithHistory: IsAttributeStorage;

  constructor(logger: IsLogger) {
    this.pgStorageWithHistory = new PsqlStorageWithHistory(logger);
  }

  insertAttributeSnapshot(
    attributeId: string,
    actorId: string,
    value: string,
    changeId?: string,
  ): Promise<{ id: string; }> {
    return this.pgStorageWithHistory.insertAttributeSnapshot(attributeId, actorId, value, changeId);
  }

  createAttribute(
    attributeId: string,
    actorId: string,
    value: string,
  ) : Promise<{ id: string }> {
    return this.pgStorageWithHistory.createAttribute(attributeId, actorId, value);
  }

  getAttributeLatestSnapshot(
    attributeId: string,
    actorId: string,
    criteria: AttributeChangeCriteria,
  ) : Promise<AttributeSnapshot> {
    return this.pgStorageWithHistory.getAttributeLatestSnapshot(attributeId, actorId, criteria);
  }

  getAttributeChanges(
    attributeId: string,
    actorId: string,
    criteria: AttributeChangeCriteria,
  ) : Promise<Array<any>> {
    return this.pgStorageWithHistory.getAttributeChanges(attributeId, actorId, criteria);
  }

  insertAttributeChange(
    attributeId: string,
    actorId: string,
    change: string,
  ) : Promise<AttributeChange> {
    return this.pgStorageWithHistory.insertAttributeChange(attributeId, actorId, change);
  }
}
