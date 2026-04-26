/* eslint-disable import/no-cycle */
/* eslint-disable class-methods-use-this */

import assert from 'assert';
import IsRecordStorage from '../../abstract/is_record_storage';
import PgPoolWithLog from '../../../../lib/pg-log';
import IsLogger from '../../../../lib/is_logger';
import Fact from '../../../facts/server';
import AuthorizationError from '../../errors/authorization_error';
import EnsureIsValid from '../../../../lib/utils/sql_values';
import { RecordSnapshot, RecordChangeCriteria, RecordValue } from '../types';
import chunk from '../../../../lib/utils/chunk_array';

function getUuidByRecordId(recordId: string) {
  const parts = recordId.split('-');

  parts.shift();

  return EnsureIsValid.nodeId(parts.join('-'));
}

function calculateSize(value: RecordValue) {
  if (typeof value === 'string') {
    return Buffer.byteLength(value, 'utf8');
  }

  return value.length;
}

export default class AttributeStorage implements IsRecordStorage {
  logger: IsLogger;

  pgPool: PgPoolWithLog;

  tablePrefix: string;

  constructor(logger: IsLogger, tablePrefix: string) {
    this.logger = logger;
    this.pgPool = new PgPoolWithLog(this.logger);
    this.tablePrefix = tablePrefix;
  }

  async getSizeInBytesForAllRecords(nodes: string[]): Promise<number> {
    const attrTables = [`${this.tablePrefix}_attributes`];

    const sizes = await Promise.all(attrTables.map(async (tableName) => {
      const [prefix] = tableName.split('_');
      const filteredNodes = nodes.filter((n) => n.startsWith(`${prefix}-`));

      if (!filteredNodes.length) {
        return 0;
      }

      const result = await this.pgPool.query(`SELECT SUM(
          CASE
            WHEN size IS NOT NULL THEN size
            ELSE LENGTH(value)
          END
        )
        FROM ${tableName}
        WHERE ('${prefix}' || '-' || id)
        IN (${filteredNodes.filter((n) => n.startsWith(`${prefix}-`)).map((n) => `'${n}'`).join(',')});`);

      if (!result?.rows[0]) {
        throw new Error('There was a problem getting the size of all accountable records');
      }

      let size: number;

      try {
        if (result.rows[0].sum === null) {
          size = 0;
        } else {
          size = parseInt(result.rows[0].sum, 10);
        }
      } catch (e) {
        throw new Error('There was a problem getting the size of all accountable records');
      }

      return size;
    }));

    return sizes.reduce((acc, curr) => acc + curr, 0);
  }

  async createAllRecords(
    attr: { recordId: string, actorId: string, value: RecordValue, size?: number }[],
  ) : Promise<{ id: string }[]> {
    if (!attr.length) {
      return [];
    }

    if (await Fact.areKnownSubjects(attr.map((a) => a.recordId), this.logger)) {
      throw new Error('record list contains invalid recordId');
    }

    const tableNames = await Promise.all(
      attr.map((a) => this.getRecordTableName(a.recordId)),
    );

    if (!tableNames[0]) {
      return [];
    }

    if (!tableNames.every((n) => n === tableNames[0])) {
      throw new Error('createAllRecords can only be used with records of the same type');
    }

    const values = attr
      .map((_, i) => `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`)
      .join(', ');

    const flatParams = attr.flatMap((a) => [
      a.actorId,
      new Date(),
      new Date(),
      getUuidByRecordId(a.recordId),
      a.value,
      a.size || null,
    ]);

    const createQuery = `INSERT INTO ${EnsureIsValid.tableName(tableNames[0])} (actor_id, updated_at, created_at, id, value, size) VALUES ${values}`;
    await this.pgPool.query(createQuery, flatParams);

    return attr.map((a) => ({ id: a.recordId }));
  }

  async createRecord(
    recordId: string,
    actorId: string,
    value: RecordValue,
    size?: number,
  ) : Promise<{ id: string }> {
    if (await Fact.areKnownSubjects([recordId], this.logger)) {
      throw new Error('recordId is invalid');
    }

    return this.createRecordWithoutFactsCheck(
      recordId,
      actorId,
      value,
      size,
    );
  }

  async createRecordWithoutFactsCheck(
    recordId: string,
    actorId: string,
    value: RecordValue,
    size?: number,
  ) : Promise<{ id: string }> {
    const pgTableName = await this.getRecordTableName(recordId);
    const createQuery = `INSERT INTO ${EnsureIsValid.tableName(pgTableName)} (id, actor_id, updated_at, created_at, value, size) VALUES ($1, $2, $3, $4, $5, $6)`;
    await this.pgPool.query(createQuery, [
      getUuidByRecordId(recordId),
      actorId,
      new Date(),
      new Date(),
      value,
      size || calculateSize(value),
    ]);

    return { id: recordId };
  }

  async getRecordLatestSnapshots(
    recordIds: string[],
    actorId: string,
    arg: RecordChangeCriteria = {},
  ) : Promise<RecordSnapshot[]> {
    if (!recordIds.length) {
      return [];
    }

    const chunks = chunk<string>(recordIds, 1000);
    const chunkedResult = await Promise.all(
      chunks.map((c) => this.getRecordLatestSnapshotsUnchunked(c, actorId, arg)),
    );

    return chunkedResult.flat();
  }

  private async getRecordLatestSnapshotsUnchunked(
    recordIds: string[],
    actorId: string,
    { inAuthorizedContext = false }: RecordChangeCriteria = {},
  ) : Promise<RecordSnapshot[]> {
    if (!recordIds.length) {
      return [];
    }

    assert(inAuthorizedContext, 'getRecordLatestSnapshots is not implemented in unauthorized context');
    assert(recordIds[0]);
    assert(!recordIds.find((id) => !id || typeof id !== 'string'));

    const idPrefix = recordIds[0].split('-')[0];

    assert(idPrefix, 'getRecordLatestSnapshots: at least one ID is invalid!');
    assert(!recordIds.find((id) => !id.startsWith(idPrefix)), 'getRecordLatestSnapshots: all record IDs need to have the same prefix!');

    const pgTableName = await this.getRecordTableName(recordIds[0]);
    const idsAsString = recordIds.map((id) => `'${getUuidByRecordId(id)}'`);
    const snapshots = await this.pgPool.query(`SELECT id, value, actor_id, created_at, updated_at from ${EnsureIsValid.tableName(pgTableName)} WHERE id IN (${idsAsString.join(',')})`);

    return snapshots.rows.map((snapshot) => ({
      id: `${idPrefix}-${snapshot.id}`,
      value: snapshot.value,
      changeId: snapshot.change_id,
      actorId: snapshot.actor_id,
      createdAt: Date.parse(snapshot.created_at),
      updatedAt: Date.parse(snapshot.updated_at),
    }));
  }

  async getRecordLatestSnapshot(
    recordId: string,
    actorId: string,
    { maxChangeId = '2147483647', inAuthorizedContext = false }: RecordChangeCriteria = {},
  ) : Promise<RecordSnapshot> {
    if (!inAuthorizedContext) {
      if (!(await Fact.isAuthorizedToReadPayload(recordId, actorId, this.logger))) {
        // TODO: when this is thrown, it is not visible in the logs probably??
        // And the status code is 500
        throw new AuthorizationError(actorId, 'record', recordId, this.logger);
      }
    }

    const pgTableName = await this.getRecordTableName(recordId);
    const snapshots = await this.pgPool.query(`SELECT value, actor_id, created_at, updated_at from ${EnsureIsValid.tableName(pgTableName)} WHERE id=$1 LIMIT 1`, [
      getUuidByRecordId(recordId),
    ]);

    if (!snapshots.rows.length) {
      throw new Error(`Record not found (id: ${recordId})`);
    }

    const snapshot = snapshots.rows[0];

    if (!snapshot) {
      throw new Error(`No Snapshot found for record ${recordId} with maxChangeId=${maxChangeId}!`);
    }

    return {
      id: recordId,
      value: snapshot.value,
      changeId: snapshot.change_id,
      actorId: snapshot.actor_id,
      createdAt: Date.parse(snapshot.created_at),
      updatedAt: Date.parse(snapshot.updated_at),
    };
  }

  async getRecordChanges() : Promise<Array<any>> {
    return [];
  }

  async insertRecordChange() : Promise<{ id: string, updatedAt: Date }> {
    throw new Error('insertRecordChange is not implemented for psql storage, use psql_with_history instead');
  }

  async insertRecordSnapshot(
    recordId: string,
    actorId: string,
    value: RecordValue,
    changeId?: string,
    size?: number,
  ) : Promise<{ id: string, updatedAt: Date }> {
    if (!(await Fact.isAuthorizedToModifyPayload(recordId, actorId, this.logger))) {
      throw new AuthorizationError(actorId, 'record', recordId, this.logger);
    }

    const pgTableName = await this.getRecordTableName(recordId);
    const result = await this.pgPool.query(`UPDATE ${EnsureIsValid.tableName(pgTableName)} SET actor_id=$1, updated_at=$2, value=$3, size=$4 WHERE id=$5 RETURNING updated_at`, [
      actorId,
      new Date(),
      value,
      size || calculateSize(value),
      getUuidByRecordId(recordId),
    ]);

    if (!result.rows.length) {
      throw new Error(`Record not found (id: ${recordId})`);
    }

    return { id: '2147483647', updatedAt: new Date(result.rows[0].updated_at) };
  }

  private async getRecordTableName(recordId: string) {
    const [prefix] = recordId.split('-');

    if (!prefix) {
      throw new Error(`invalid record Id: ${recordId}`);
    }

    return `${prefix}_attributes`;
  }
}
