import { Readable } from 'stream';
import { RecordValue } from '../record_storage/types';

export default interface IsRecordStorage {
  createRecordWithoutFactsCheck(
    recordId: string,
    actorId: string,
    value: RecordValue,
  ) : Promise<{ id: string }>;

  createRecord(
    recordId: string,
    actorId: string,
    value: RecordValue,
  ) : Promise<{ id: string }>;

  createAllRecords(
    attr: { recordId: string, actorId: string, value: RecordValue }[]
  ) : Promise<{ id: string }[]>;

  getRecordLatestSnapshot(
    recordId: string,
    actorId: string,
    criteria: { maxChangeId?: string, inAuthorizedContext?: boolean }
  ) : Promise<{
    value: string,
    changeId: string,
    actorId: string,
    createdAt: number,
    updatedAt: number
  }>;

  getRecordLatestSnapshotAsReadable?(
    recordId: string,
    actorId: string,
    criteria: { maxChangeId?: string, inAuthorizedContext?: boolean }
  ) : Promise<{
    value: Readable,
    changeId: string,
    actorId: string,
    createdAt: number,
    updatedAt: number
  }>;

  getRecordChanges(
    recordId: string,
    actorId: string,
    criteria: { inAuthorizedContext?: boolean, minChangeId?: string, maxChangeId?: string }
  ) : Promise<Array<any>>;

  insertRecordChange(
    recordId: string,
    actorId: string,
    change: string
  ) : Promise<{ id: string, updatedAt: Date }>;

  insertRecordSnapshot(
    recordId: string,
    actorId: string,
    value: RecordValue,
    changeId?: string,
  ) : Promise<{ id: string, updatedAt: Date }>;

  getSizeInBytesForAllRecords(
    nodes: string[],
  ): Promise<number>;
}

// backwards-compat alias
export type IsAttributeStorage = IsRecordStorage;
