/* eslint-disable class-methods-use-this */

import pg from 'pg';
import IsAttributeStorage from '../../abstract/is_attribute_storage';

const pgPool = new pg.Pool({ max: 2 });

export default class PsqlStorage implements IsAttributeStorage {
  async createAttribute(
    attributeId: string,
    actorId: string,
    value: string,
  ) : Promise<{ id: string }> {
    const pgTableName = PsqlStorage.getAttributeTableName(attributeId);
    const createQuery = `CREATE TABLE ${pgTableName} (actor_id varchar(36), time timestamp, change_id SERIAL, value TEXT, delta boolean, meta_info boolean);`;

    await new Promise((resolve, reject) => {
      pgPool.connect((err, pgclient, releaseDBConnection) => {
        if (err) {
          reject(err);
          return;
        }

        pgclient.query(createQuery, [], (createErr) => {
          if (createErr) {
            reject(createErr);
            return;
          }

          releaseDBConnection();
          resolve(attributeId);
        });
      });
    });

    await this.insertAttributeSnapshot(attributeId, actorId, value);

    return { id: attributeId };
  }

  getAttributeLatestSnapshot(attributeId: string, { maxChangeId = '2147483647' }) : Promise<{ value: string, changeId: string, actorId: string, createdAt: number, updatedAt: number }> {
    const pgTableName = PsqlStorage.getAttributeTableName(attributeId);

    return new Promise((resolve, reject) => {
      pgPool.connect((err, pgclient, releaseDBConnection) => {
        if (err) {
          reject(err);
          return;
        }

        pgclient.query(`
                    SELECT
                        value,
                        change_id,
                        actor_id,
                        time as updated_at,
                        (SELECT MIN(time) FROM ${pgTableName} LIMIT 1) as created_at
                    FROM ${pgTableName}
                    WHERE delta=false
                    AND change_id <= $1
                    ORDER BY change_id
                    DESC LIMIT 1`, [maxChangeId], (selectErr, snapshots) => {
          if (selectErr) {
            reject(selectErr);
            return;
          }

          const snapshot = snapshots.rows[0];

          if (!snapshot) {
            reject(new Error(`No Snapshot found for attribute ${attributeId} with maxChangeId=${maxChangeId}!`));
            return;
          }

          resolve({
            value: snapshot.value,
            changeId: snapshot.change_id,
            actorId: snapshot.actor_id,
            createdAt: Date.parse(snapshot.created_at),
            updatedAt: Date.parse(snapshot.updated_at),
          });

          releaseDBConnection();
        });
      });
    });
  }

  getAttributeChanges(attributeId: string, { minChangeId = '0', maxChangeId = '2147483647' } = {}) : Promise<Array<any>> {
    const pgTableName = PsqlStorage.getAttributeTableName(attributeId);

    return new Promise((resolve, reject) => {
      pgPool.connect((err, pgclient, releaseDBConnection) => {
        if (err) {
          reject(err);
          return;
        }

        pgclient.query(`
                    SELECT
                        value,
                        change_id,
                        actor_id,
                        time
                    FROM ${pgTableName}
                    WHERE change_id > $1
                    AND change_id <= $2
                    AND delta = true
                    ORDER BY change_id ASC`, [minChangeId, maxChangeId], (selectErr, changes) => {
          if (selectErr) {
            reject(selectErr);
            return;
          }

          resolve(
            changes.rows.map((row) => ({
              value: row.value,
              changeId: row.change_id,
              actorId: row.actor_id,
              time: row.time,
            })),
          );

          releaseDBConnection();
        });
      });
    });
  }

  insertAttributeChange(
    attributeId: string,
    actorId: string,
    change: string,
  ) : Promise<{ id: string, updatedAt: Date }> {
    const pgTableName = PsqlStorage.getAttributeTableName(attributeId);

    return new Promise((resolve, reject) => {
      pgPool.connect((connectErr, pgclient, releaseDBConnection) => {
        if (connectErr) {
          reject(connectErr);
          return;
        }

        pgclient.query(`INSERT INTO ${pgTableName} (actor_id, time, value, delta) VALUES ($1, $2, $3, true) RETURNING change_id, time`, [actorId, new Date(), change], (insertErr, result) => {
          if (insertErr) {
            reject(insertErr);
            return;
          }

          releaseDBConnection();
          resolve({ id: result.rows[0].change_id, updatedAt: new Date(result.rows[0].time) });
        });
      });
    });
  }

  insertAttributeSnapshot(
    attributeId: string,
    actorId: string,
    value: string,
  ) : Promise<{ id: string }> {
    const pgTableName = PsqlStorage.getAttributeTableName(attributeId);

    return new Promise((resolve, reject) => {
      pgPool.connect((connectErr, pgclient, releaseDBConnection) => {
        if (connectErr) {
          reject(connectErr);
          return;
        }

        pgclient.query(`INSERT INTO ${pgTableName} (actor_id, time, value, delta) VALUES ($1, $2, $3, false) RETURNING change_id`, [actorId, new Date(), value], (insertErr, result) => {
          if (insertErr) {
            reject(insertErr);
            return;
          }

          releaseDBConnection();
          resolve({ id: result.rows[0].change_id });
        });
      });
    });
  }

  private static getAttributeTableName(attributeId: string): string {
    return `var_${attributeId.replace(/-/g, '_').toLowerCase()}`;
  }
}
