import { Readable } from 'stream';

export type AttributeValue = string | Buffer;

export type AttributeSnapshotReadable = {
  value: Readable,
  changeId: string,
  actorId: string,
  createdAt: number,
  updatedAt: number
};

export type AttributeSnapshot = {
  id: string,
  value: string,
  changeId: string,
  actorId: string,
  createdAt: number,
  updatedAt: number
};

export type AttributeChange = {
  id: string,
  updatedAt: Date,
};

export type AttributeChangeCriteria = {
  inAuthorizedContext?: boolean,
  minChangeId?: string,
  maxChangeId?: string,
};

export type RecordValue = AttributeValue;
export type RecordSnapshot = AttributeSnapshot;
export type RecordSnapshotReadable = AttributeSnapshotReadable;
export type RecordChange = AttributeChange;
export type RecordChangeCriteria = AttributeChangeCriteria;
