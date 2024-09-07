/* eslint-disable class-methods-use-this */

import IsAttributeStorage from '../../abstract/is_attribute_storage';
import PgPoolWithLog from '../../../../lib/pg-log';
import IsLogger from '../../../../lib/is_logger';
import Fact from '../../../facts/server';
import AuthorizationError from '../../errors/authorization_error';
import { AttributeSnapshot, AttributeChangeCriteria } from '../types';

export default class AttributeStorage implements IsAttributeStorage {
  logger: IsLogger;

  pgPool: PgPoolWithLog;

  constructor(logger: IsLogger) {
    this.logger = logger;
    this.pgPool = new PgPoolWithLog(this.logger);
  }

  async createAttribute(
    attributeId: string,
    actorId: string,
    value: string,
  ) : Promise<{ id: string }> {
    const pgTableName = AttributeStorage.getAttributeTableName(attributeId);

    if (await this.pgPool.findAny('SELECT id FROM facts WHERE subject=$1', [attributeId])) {
      throw new Error('attributeId is invalid');
    }

    const createQuery = `CREATE TABLE ${pgTableName} (actor_id varchar(36), time timestamp, change_id SERIAL, value TEXT, delta boolean, meta_info boolean);`;
    await this.pgPool.query(createQuery);
    await this.insertAttributeSnapshot(attributeId, actorId, value);

    return { id: attributeId };
  }

  async getAttributeLatestSnapshot(
    attributeId: string,
    actorId: string,
    { maxChangeId = '2147483647', inAuthorizedContext = false }: AttributeChangeCriteria = {},
  ) : Promise<AttributeSnapshot> {
    if (!inAuthorizedContext) {
      if (!(await Fact.isAuthorizedToReadPayload(attributeId, actorId, this.logger))) {
        // TODO: when this is thrown, it is not visible in the logs probably??
        // And the status code is 500
        throw new AuthorizationError(actorId, 'attribute', attributeId, this.logger);
      }
    }

    const pgTableName = AttributeStorage.getAttributeTableName(attributeId);
    const snapshots = await this.pgPool.query(`SELECT value, change_id, actor_id, time as updated_at, (SELECT MIN(time) FROM ${pgTableName} LIMIT 1) as created_at FROM ${pgTableName} WHERE delta=false AND change_id <= $1 ORDER BY change_id DESC LIMIT 1`, [maxChangeId]);

    const snapshot = snapshots.rows[0];

    if (!snapshot) {
      throw new Error(`No Snapshot found for attribute ${attributeId} with maxChangeId=${maxChangeId}!`);
    }

    return {
      value: snapshot.value,
      changeId: snapshot.change_id,
      actorId: snapshot.actor_id,
      createdAt: Date.parse(snapshot.created_at),
      updatedAt: Date.parse(snapshot.updated_at),
    };
  }

  async getAttributeChanges(
    attributeId: string,
    actorId: string,
    { inAuthorizedContext = false, minChangeId = '0', maxChangeId = '2147483647' }: AttributeChangeCriteria = {},
  ) : Promise<Array<any>> {
    if (!inAuthorizedContext) {
      if (!(await Fact.isAuthorizedToReadPayload(attributeId, actorId, this.logger))) {
        throw new AuthorizationError(actorId, 'attribute', attributeId, this.logger);
      }
    }

    const pgTableName = AttributeStorage.getAttributeTableName(attributeId);
    const changes = await this.pgPool.query(`SELECT value, change_id, actor_id, time FROM ${pgTableName} WHERE change_id > $1 AND change_id <= $2 AND delta = true ORDER BY change_id ASC`, [minChangeId, maxChangeId]);

    return changes.rows.map((row) => ({
      value: row.value,
      changeId: row.change_id,
      actorId: row.actor_id,
      time: row.time,
    }));
  }

  async insertAttributeChange(
    attributeId: string,
    actorId: string,
    change: string,
  ) : Promise<{ id: string, updatedAt: Date }> {
    if (!(await Fact.isAuthorizedToModifyPayload(attributeId, actorId, this.logger))) {
      throw new AuthorizationError(actorId, 'attribute', attributeId, this.logger);
    }

    const pgTableName = AttributeStorage.getAttributeTableName(attributeId);
    const result = await this.pgPool.query(`INSERT INTO ${pgTableName} (actor_id, time, value, delta) VALUES ($1, $2, $3, true) RETURNING change_id, time`, [actorId, new Date(), change]);

    return { id: result.rows[0].change_id, updatedAt: new Date(result.rows[0].time) };
  }

  async insertAttributeSnapshot(
    attributeId: string,
    actorId: string,
    value: string,
    changeId?: string,
  ) : Promise<{ id: string, updatedAt: Date }> {
    if (!(await Fact.isAuthorizedToModifyPayload(attributeId, actorId, this.logger))) {
      throw new AuthorizationError(actorId, 'attribute', attributeId, this.logger);
    }

    const pgTableName = AttributeStorage.getAttributeTableName(attributeId);

    const result = changeId
      ? await this.pgPool.query(`INSERT INTO ${pgTableName} (actor_id, time, value, delta, change_id) VALUES ($1, $2, $3, false, $4) RETURNING change_id, time`, [actorId, new Date(), value, changeId])
      : await this.pgPool.query(`INSERT INTO ${pgTableName} (actor_id, time, value, delta) VALUES ($1, $2, $3, false) RETURNING change_id, time`, [actorId, new Date(), value]);

    return { id: result.rows[0].change_id, updatedAt: new Date(result.rows[0].time) };
  }

  private static getAttributeTableName(attributeId: string): string {
    if (!(typeof attributeId === 'string' && attributeId.length >= 3)) {
      throw new Error(`invalide atttributeId: ${attributeId}`);
    }

    return `var_${attributeId.replace(/-/g, '_').toLowerCase()}`;
  }
}
