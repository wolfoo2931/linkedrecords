import { Readable } from 'stream';
import { AttributeValue } from '../attribute_storage/types';

export default interface IsAttributeStorage {
  createAttributeWithoutFactsCheck(
    attributeId: string,
    actorId: string,
    value: AttributeValue,
  ) : Promise<{ id: string }>;

  createAttribute(
    attributeId: string,
    actorId: string,
    value: AttributeValue,
  ) : Promise<{ id: string }>;

  createAllAttributes(
    attr: { attributeId: string, actorId: string, value: AttributeValue }[]
  ) : Promise<{ id: string }[]>;

  getAttributeLatestSnapshot(
    attributeId: string,
    actorId: string,
    criteria: { maxChangeId?: string, inAuthorizedContext?: boolean }
  ) : Promise<{
    value: string,
    changeId: string,
    actorId: string,
    createdAt: number,
    updatedAt: number
  }>;

  getAttributeLatestSnapshotAsReadable?(
    attributeId: string,
    actorId: string,
    criteria: { maxChangeId?: string, inAuthorizedContext?: boolean }
  ) : Promise<{
    value: Readable,
    changeId: string,
    actorId: string,
    createdAt: number,
    updatedAt: number
  }>;

  getAttributeChanges(
    attributeId: string,
    actorId: string,
    criteria: { inAuthorizedContext?: boolean, minChangeId?: string, maxChangeId?: string }
  ) : Promise<Array<any>>;

  insertAttributeChange(
    attributeId: string,
    actorId: string,
    change: string
  ) : Promise<{ id: string, updatedAt: Date }>;

  insertAttributeSnapshot(
    attributeId: string,
    actorId: string,
    value: AttributeValue,
    changeId?: string,
  ) : Promise<{ id: string, updatedAt: Date }>;

  getSizeInBytesForAllAttributes(
    nodes: string[],
  ): Promise<number>;
}
