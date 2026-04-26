/* eslint-disable class-methods-use-this, import/no-cycle */

import IsRecordStorage from '../../abstract/is_record_storage';
import PgPoolWithLog from '../../../../lib/pg-log';
import IsLogger from '../../../../lib/is_logger';
import Fact from '../../../facts/server';
import AuthorizationError from '../../errors/authorization_error';
import { RecordSnapshot, RecordChangeCriteria, RecordValue } from '../types';
import EnsureIsValid from '../../../../lib/utils/sql_values';

export default class AttributeStorage implements IsRecordStorage {
  logger: IsLogger;

  pgPool: PgPoolWithLog;

  constructor(logger: IsLogger) {
    this.logger = logger;
    this.pgPool = new PgPoolWithLog(this.logger);
  }

  async getSizeInBytesForAllRecords(nodes: string[]): Promise<number> {
    const filteredNodes = nodes.filter((n) => n.startsWith('l-'));

    if (!filteredNodes.length) {
      return 0;
    }

    const createQuery = `SELECT SUM(pg_total_relation_size(quote_ident(table_name)))
      FROM information_schema.tables
      WHERE replace(replace(table_name, '_', '-'), 'var-', '') IN (${filteredNodes.map((n) => `'${n}'`).join(',')});`;

    let result;

    try {
      result = await this.pgPool.query(createQuery);
    } catch (err) {
      this.logger?.warn(`pg_total_relation_size unavailable, returning 0 for storage size: ${err}`);
      return 0;
    }

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
  }

  async createAllRecords(
    attr: { recordId: string, actorId: string, value: RecordValue }[],
  ) : Promise<{ id: string }[]> {
    return Promise.all(attr.map((a) => this.createRecord(a.recordId, a.actorId, a.value)));
  }

  async createRecord(
    recordId: string,
    actorId: string,
    value: RecordValue,
  ) : Promise<{ id: string }> {
    if (await Fact.areKnownSubjects([recordId], this.logger)) {
      throw new Error('recordId is invalid');
    }

    return this.createRecordWithoutFactsCheck(recordId, actorId, value);
  }

  async createRecordWithoutFactsCheck(
    recordId: string,
    actorId: string,
    value: RecordValue,
  ) : Promise<{ id: string }> {
    const pgTableName = AttributeStorage.getRecordTableName(recordId);

    const createQuery = `CREATE TABLE ${EnsureIsValid.tableName(pgTableName)} (actor_id varchar(36), time timestamp, change_id SERIAL, value TEXT, delta boolean, meta_info boolean);`;
    await this.pgPool.query(createQuery);
    await this.insertRecordSnapshot(recordId, actorId, value);

    return { id: recordId };
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

    const pgTableName = AttributeStorage.getRecordTableName(recordId);
    const snapshots = await this.pgPool.query(`SELECT value, change_id, actor_id, time as updated_at, (SELECT MIN(time) FROM ${EnsureIsValid.tableName(pgTableName)} LIMIT 1) as created_at FROM ${EnsureIsValid.tableName(pgTableName)} WHERE delta=false AND change_id <= $1 ORDER BY change_id DESC LIMIT 1`, [maxChangeId]);

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

  async getRecordChanges(
    recordId: string,
    actorId: string,
    { inAuthorizedContext = false, minChangeId = '0', maxChangeId = '2147483647' }: RecordChangeCriteria = {},
  ) : Promise<Array<any>> {
    if (!inAuthorizedContext) {
      if (!(await Fact.isAuthorizedToReadPayload(recordId, actorId, this.logger))) {
        throw new AuthorizationError(actorId, 'record', recordId, this.logger);
      }
    }

    const pgTableName = AttributeStorage.getRecordTableName(recordId);
    const changes = await this.pgPool.query(`SELECT value, change_id, actor_id, time FROM ${EnsureIsValid.tableName(pgTableName)} WHERE change_id > $1 AND change_id <= $2 AND delta = true ORDER BY change_id ASC`, [minChangeId, maxChangeId]);

    return changes.rows.filter((row) => row.value !== null).map((row) => ({
      value: row.value,
      changeId: row.change_id,
      actorId: row.actor_id,
      time: row.time,
    }));
  }

  async insertRecordChange(
    recordId: string,
    actorId: string,
    change: string,
  ) : Promise<{ id: string, updatedAt: Date }> {
    if (!(await Fact.isAuthorizedToModifyPayload(recordId, actorId, this.logger))) {
      throw new AuthorizationError(actorId, 'record', recordId, this.logger);
    }

    const pgTableName = AttributeStorage.getRecordTableName(recordId);
    const result = await this.pgPool.query(`INSERT INTO ${EnsureIsValid.tableName(pgTableName)} (actor_id, time, value, delta) VALUES ($1, $2, $3, true) RETURNING change_id, time`, [actorId, new Date(), change]);

    return { id: result.rows[0].change_id, updatedAt: new Date(result.rows[0].time) };
  }

  async insertRecordSnapshot(
    recordId: string,
    actorId: string,
    value: RecordValue,
    changeId?: string,
  ) : Promise<{ id: string, updatedAt: Date }> {
    if (!(await Fact.isAuthorizedToModifyPayload(recordId, actorId, this.logger))) {
      throw new AuthorizationError(actorId, 'record', recordId, this.logger);
    }

    const pgTableName = AttributeStorage.getRecordTableName(recordId);

    const result = changeId
      ? await this.pgPool.query(`INSERT INTO ${EnsureIsValid.tableName(pgTableName)} (actor_id, time, value, delta, change_id) VALUES ($1, $2, $3, false, $4) RETURNING change_id, time`, [actorId, new Date(), value, changeId])
      : await this.pgPool.query(`INSERT INTO ${EnsureIsValid.tableName(pgTableName)} (actor_id, time, value, delta) VALUES ($1, $2, $3, false) RETURNING change_id, time`, [actorId, new Date(), value]);

    return { id: result.rows[0].change_id, updatedAt: new Date(result.rows[0].time) };
  }

  private static getRecordTableName(recordId: string): string {
    if (!(typeof recordId === 'string' && recordId.length >= 3)) {
      throw new Error(`invalid recordId: ${recordId}`);
    }

    return `var_${recordId.replace(/-/g, '_').toLowerCase()}`;
  }
}
