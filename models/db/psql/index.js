const pg = require('pg');
const pgPool = new pg.Pool({ max: 2 });
const uuid = require('uuid/v4');

class PsqlStorage {
    static createAttribute(actorId, value) {
        const variableID = uuid();
        const pgTableName = 'var_' + variableID.replace(new RegExp('-', 'g'), '_').toLowerCase();
        const query = `CREATE TABLE ${pgTableName} (actor_id uuid, time timestamp, change_id SERIAL, value TEXT, delta boolean, meta_info boolean);
                       INSERT INTO  ${pgTableName} (actor_id, time, value, delta) VALUES ('${actorId}', NOW(), '${value}', false)`;

        return new Promise((resolve, reject) => {
            pgPool.connect((err, pgclient, releaseDBConnection) => {
                if(err) {
                    reject(err);
                    return;
                }
                pgclient.query(query, (err, result) => {
                    if(err) {
                        reject(err);
                        return;
                    }

                    releaseDBConnection();
                    resolve(variableID);
                    return;
                });
            });
        });
    }

    static getAttributeLatestSnapshot(variableId, { maxChangeId = 2147483647 }) {
        const pgTableName = 'var_' + variableId.replace(new RegExp('-', 'g'), '_').toLowerCase();

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
                    AND change_id <= ${maxChangeId}
                    ORDER BY change_id
                    DESC LIMIT 1`, (err, snapshots) => {

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

    static getAttributeChanges(variableId, { minChangeId = 0, maxChangeId = 2147483647 } = {}) {
        const pgTableName = 'var_' + variableId.replace(new RegExp('-', 'g'), '_').toLowerCase();

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
                    WHERE change_id > ${minChangeId}
                    AND change_id <= ${maxChangeId}
                    AND delta=true
                    ORDER BY change_id ASC`, (err, changes) => {

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

    static insertAttributeChange(variableId, actorId, change) {
        const pgTableName = 'var_' + variableId.replace(new RegExp('-', 'g'), '_').toLowerCase();

        return new Promise((resolve, reject) => {
            pgPool.connect((err, pgclient, releaseDBConnection) => {
                if(err) {
                    reject(err)
                    return;
                }

                pgclient.query("INSERT INTO " + pgTableName + " (actor_id, time, value, delta) VALUES ('" + actorId + "', NOW(), '" + change + "', true) RETURNING change_id", (err, result) => {
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

    static insertAttributeSnapshot(variableId, actorId, value) {
        const pgTableName = 'var_' + variableId.replace(new RegExp('-', 'g'), '_').toLowerCase();

        return new Promise((resolve, reject) => {
            pgPool.connect((err, pgclient, releaseDBConnection) => {
                if(err) {
                    reject(err)
                    return;
                }

                pgclient.query(`INSERT INTO ${pgTableName} (actor_id, time, value, delta) VALUES ('${actorId}', NOW(), '${value}', false) RETURNING change_id`, (err, result) => {
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
}

module.exports = PsqlStorage
