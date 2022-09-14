import pg from 'pg';
import { AttributeStorage } from '../storage';
const pgPool = new pg.Pool({ max: 2 });

export class PsqlStorage implements AttributeStorage {

    async createAttribute(attributeId: string, actorId: string, value: string) : Promise<string> {
        const pgTableName = this.getAttributeTableName(attributeId);
        const createQuery = `CREATE TABLE ${pgTableName} (actor_id uuid, time timestamp, change_id SERIAL, value TEXT, delta boolean, meta_info boolean);`;

        await new Promise((resolve, reject) => {
            pgPool.connect((err, pgclient, releaseDBConnection) => {
                if(err) {
                    reject(err);
                    return;
                }

                pgclient.query(createQuery, [], (err, result) => {
                    if(err) {
                        reject(err);
                        return;
                    }

                    releaseDBConnection();
                    resolve(attributeId);
                    return;
                });
            });
        });

        await this.insertAttributeSnapshot(attributeId, actorId, value);

        return attributeId;
    }

    getAttributeLatestSnapshot(attributeId: string, { maxChangeId = '2147483647' }) : Promise<{value: string, changeId: string, actorId: string}> {
        const pgTableName = this.getAttributeTableName(attributeId);

        return new Promise((resolve, reject) => {
            pgPool.connect((err, pgclient, releaseDBConnection) => {

                if(err) {
                    reject(err)
                    return;
                }

                pgclient.query(`
                    SELECT
                        value,
                        change_id,
                        actor_id
                    FROM ${pgTableName}
                    WHERE delta=false
                    AND change_id <= $1
                    ORDER BY change_id
                    DESC LIMIT 1`, [maxChangeId], (err, snapshots) => {

                    if(err) {
                        reject(err);
                        return;
                    }

                    const snapshot = snapshots.rows[0];

                    if(!snapshot) {
                        reject(new Error('No Snapshot found!'));
                    }

                    resolve({
                        value: snapshot.value,
                        changeId: snapshot.change_id,
                        actorId: snapshot.actor_id
                    });

                    releaseDBConnection();
                });
            });
        });
    }

    getAttributeChanges(attributeId: string, { minChangeId = '0', maxChangeId = '2147483647' } = {}) : Promise<Array<any>> {
        const pgTableName = this.getAttributeTableName(attributeId);

        return new Promise((resolve, reject) => {
            pgPool.connect((err, pgclient, releaseDBConnection) => {

                if(err) {
                    reject(err)
                    return;
                }

                pgclient.query(`
                    SELECT
                        value,
                        change_id,
                        actor_id
                    FROM ${pgTableName}
                    WHERE change_id > $1
                    AND change_id <= $2
                    AND delta=true
                    ORDER BY change_id ASC`, [minChangeId, maxChangeId], (err, changes) => {

                    if(err) {
                        reject(err)
                        return;
                    }

                    resolve(
                        changes.rows.map(row => ({
                            value: row.value,
                            changeId: row.change_id,
                            actorId: row.actor_id,
                        }))
                    );

                    releaseDBConnection();
                });
            });
        });
    }

    insertAttributeChange(attributeId: string, actorId: string, change: string) : Promise<string> {
        const pgTableName = this.getAttributeTableName(attributeId);

        return new Promise((resolve, reject) => {
            pgPool.connect((err, pgclient, releaseDBConnection) => {
                if(err) {
                    reject(err)
                    return;
                }

                pgclient.query(`INSERT INTO ${pgTableName} (actor_id, time, value, delta) VALUES ($1, NOW(), $2, true) RETURNING change_id`, [actorId, change], (err, result) => {
                    if(err) {
                        reject(err)
                        return;
                    }

                    releaseDBConnection();
                    resolve(result.rows[0].change_id);
                });
            });
        });
    }

    insertAttributeSnapshot(attributeId: string, actorId: string, value: string) : Promise<{ id: string }> {
        const pgTableName = this.getAttributeTableName(attributeId);

        return new Promise((resolve, reject) => {
            pgPool.connect((err, pgclient, releaseDBConnection) => {
                if(err) {
                    reject(err)
                    return;
                }

                pgclient.query(`INSERT INTO ${pgTableName} (actor_id, time, value, delta) VALUES ($1, NOW(), $2, false) RETURNING change_id`, [actorId, value], (err, result) => {
                    if(err) {
                        reject(err)
                        return;
                    }

                    releaseDBConnection();
                    resolve({ id: result.rows[0].change_id });
                });
            });
        });
    }

    private getAttributeTableName(attributeId: string): string {
        return 'var_' + attributeId.replace(new RegExp('[-:]', 'g'), '_').toLowerCase();
    }
}

