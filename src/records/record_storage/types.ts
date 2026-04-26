import { Readable } from 'stream';

export type RecordValue = string | Buffer;

export type RecordSnapshotReadable = {
  value: Readable,
  changeId: string,
  actorId: string,
  createdAt: number,
  updatedAt: number
};

export type RecordSnapshot = {
  id: string,
  value: string,
  changeId: string,
  actorId: string,
  createdAt: number,
  updatedAt: number
};

export type RecordChange = {
  id: string,
  updatedAt: Date,
};

export type RecordChangeCriteria = {
  inAuthorizedContext?: boolean,
  minChangeId?: string,
  maxChangeId?: string,
};

// backwards-compat aliases
export type AttributeValue = RecordValue;
export type AttributeSnapshot = RecordSnapshot;
export type AttributeSnapshotReadable = RecordSnapshotReadable;
export type AttributeChange = RecordChange;
export type AttributeChangeCriteria = RecordChangeCriteria;
