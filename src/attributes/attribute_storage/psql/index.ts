/* eslint-disable class-methods-use-this */

import IsAttributeStorage from '../../abstract/is_attribute_storage';
import pgPool from '../../../../lib/pg-log';

export default class PsqlStorage implements IsAttributeStorage {
  async createAttribute(
    attributeId: string,
    actorId: string,
    value: string,
  ) : Promise<{ id: string }> {
    const pgTableName = PsqlStorage.getAttributeTableName(attributeId);
    const createQuery = `CREATE TABLE ${pgTableName} (actor_id varchar(36), time timestamp, change_id SERIAL, value TEXT, delta boolean, meta_info boolean);`;
    await pgPool.query(createQuery);
    await this.insertAttributeSnapshot(attributeId, actorId, value);

    return { id: attributeId };
  }

  async getAttributeLatestSnapshot(attributeId: string, { maxChangeId = '2147483647' }) : Promise<{ value: string, changeId: string, actorId: string, createdAt: number, updatedAt: number }> {
    const pgTableName = PsqlStorage.getAttributeTableName(attributeId);

    const snapshots = await pgPool.query(`SELECT value, change_id, actor_id, time as updated_at, (SELECT MIN(time) FROM ${pgTableName} LIMIT 1) as created_at FROM ${pgTableName} WHERE delta=false AND change_id <= $1 ORDER BY change_id DESC LIMIT 1`, [maxChangeId]);

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

  async getAttributeChanges(attributeId: string, { minChangeId = '0', maxChangeId = '2147483647' } = {}) : Promise<Array<any>> {
    const pgTableName = PsqlStorage.getAttributeTableName(attributeId);

    const changes = await pgPool.query(`SELECT value, change_id, actor_id, time FROM ${pgTableName} WHERE change_id > $1 AND change_id <= $2 AND delta = true ORDER BY change_id ASC`, [minChangeId, maxChangeId]);

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
    const pgTableName = PsqlStorage.getAttributeTableName(attributeId);

    const result = await pgPool.query(`INSERT INTO ${pgTableName} (actor_id, time, value, delta) VALUES ($1, $2, $3, true) RETURNING change_id, time`, [actorId, new Date(), change]);

    return { id: result.rows[0].change_id, updatedAt: new Date(result.rows[0].time) };
  }

  async insertAttributeSnapshot(
    attributeId: string,
    actorId: string,
    value: string,
  ) : Promise<{ id: string }> {
    const pgTableName = PsqlStorage.getAttributeTableName(attributeId);
    const result = await pgPool.query(`INSERT INTO ${pgTableName} (actor_id, time, value, delta) VALUES ($1, $2, $3, false) RETURNING change_id`, [actorId, new Date(), value]);

    return { id: result.rows[0].change_id };
  }

  private static getAttributeTableName(attributeId: string): string {
    return `var_${attributeId.replace(/-/g, '_').toLowerCase()}`;
  }
}
