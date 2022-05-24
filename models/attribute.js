var pg = require('pg'),
    uuid = require('uuid/v4'),
    pgPool = new pg.Pool({ max: 2 }),
    Changeset = require('changesets').Changeset,
    diffMatchPatch = require('diff_match_patch'),
    diffEngine = new diffMatchPatch.diff_match_patch,
    queue = require('queue')({concurrency: 1, autostart: true});

class Attribute {
    static create(args, deliver) {
        var variableID = uuid(),
            pgTableName = 'var_' + variableID.replace(new RegExp('-', 'g'), '_').toLowerCase(),
            createVariableTableQuery,
            insertVariableValueQuery;

        if(!args.actorId) {
            deliver(new Error('actorId argument must be present'));
            return;
        }

        if(!args.value) {
            deliver(new Error('value argument must be present'));
            return;
        }

        if(!args.actorId.match(/^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i)) {
            deliver(new Error('actorId is "' + args.actorId + '" but it must be a valid uuid'));
            return;
        }

        pgPool.connect((err, pgclient, releaseDBConnection) => {
            createVariableTableQuery = "CREATE TABLE " + pgTableName + " (actor_id uuid, time timestamp, change_id SERIAL, value TEXT, delta boolean);";
            insertVariableValueQuery = "INSERT INTO " + pgTableName + " (actor_id, time, value, delta) VALUES ('" + args.actorId + "', NOW(), '" + args.value + "', false)";

            pgclient.query(createVariableTableQuery + insertVariableValueQuery, (err, result) => {
                releaseDBConnection();
                deliver(variableID);
                return;
            });
        });
    }

    static get(args, deliver) {
        var pgTableName, value, changeId, actorId, changeIdLimitationSQLAddition = '';

        if(!args.variableId) {
            deliver(new Error('variableId argument must be present'));
            return;
        }

        pgTableName = 'var_' + args.variableId.replace(new RegExp('-', 'g'), '_').toLowerCase();

        pgPool.connect((err, pgclient, releaseDBConnection) => {

            if(err) {
                console.error(err)
            }

            if(args.changeId) {
                changeIdLimitationSQLAddition = "AND change_id <= " + args.changeId + " ";
            }

            pgclient.query("SELECT value, change_id, actor_id FROM " + pgTableName + " WHERE delta=false " + changeIdLimitationSQLAddition + "ORDER BY change_id DESC LIMIT 1", (err, lastNonDeltaRow) => {
                if(err && err.message === 'relation "' + pgTableName + '" does not exist') {
                    releaseDBConnection();
                    deliver(new Error('variable with id "' + args.variableId + '" does not exist'));
                    return;
                }

                value = lastNonDeltaRow.rows[0].value;
                changeId = lastNonDeltaRow.rows[0].change_id;
                actorId = lastNonDeltaRow.rows[0].actor_id;

                pgclient.query("SELECT value, change_id, actor_id FROM " + pgTableName + " WHERE change_id > " + lastNonDeltaRow.rows[0].change_id + changeIdLimitationSQLAddition +" AND delta=true ORDER BY change_id ASC", (err, changes) => {
                    changes.rows.forEach((row) => {
                        value = Changeset.unpack(row.value).apply(value);
                        changeId = row.change_id;
                        actorId = row.actor_id;
                    })

                    releaseDBConnection();
                    deliver({value: value, changeId: changeId, actorId: actorId});
                });

            });
        });
    }

    static set(args, deliver) {
        queue.push((cb) => {
            this._changeVariable(args, (result) => {
                deliver(result);
                cb();
            });
        });
    }

    static _changeVariable(args, deliver) {
        if(!args.variableId) {
            deliver(new Error('variableId argument must be present'));
            return;
        }

        if(!args.value && !args.change) {
            deliver(new Error('either value or changeset argument must be present'));
            return;
        }

        if(args.value && args.change) {
            deliver(new Error('either value or change argument must be present (specifying both is not allowed)'));
            return;
        }

        if(args.change) {
            try {
                Changeset.unpack(args.change.changeset);
            } catch(err) {
                deliver(new Error('the specified changeset is invalid (must be a string that has been serialized with changeset.pack(); see: https://github.com/marcelklehr/changesets/blob/master/lib/Changeset.js#L320-L337)'));
                return;
            }

            if(!args.change.parentVersion) {
                deliver(new Error('the changeset must also contain a parent version'));
                return;
            }
        }

        if(!args.actorId) {
            deliver(new Error('actorId argument must be present'));
            return;
        }

        if(!args.actorId.match(/^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i)) {
            deliver(new Error('actorId is "' + args.actorId + '" but it must be a valid uuid'));
            return;
        }

        if(args.value) {
            this._changeVariableByValue(args, deliver);
        } else if(args.change) {
            this._changeVariableByChangeset(args, deliver);
        }
    }

    static _changeVariableByValue(args, deliver) {
        var pgTableName = 'var_' + args.variableId.replace(new RegExp('-', 'g'), '_').toLowerCase(),
            insertVariableValueQuery,
            changeID;

        pgPool.connect((err, pgclient, releaseDBConnection) => {
            if(err) {
                console.error(err)
            }

            insertVariableValueQuery = "INSERT INTO " + pgTableName + " (actor_id, time, value, delta) VALUES ('" + args.actorId + "', NOW(), '" + args.value + "', false) RETURNING change_id";
            pgclient.query(insertVariableValueQuery, (err, result) => {
                if(err) {
                    console.error(err)
                } else {
                    changeID = result.rows[0].change_id;
                }

                if(err && err.message === 'relation "' + pgTableName + '" does not exist') {
                    releaseDBConnection();
                    deliver(new Error('variable with id "' + args.variableId + '" does not exist'));
                    return;
                }

                releaseDBConnection();
                deliver(err || {id: changeID});
            });
        });
    }

    // Applies the changeset which can be based on an older version of the veriable value.
    // This is because the client which constructed the change set might have the latest changes from the server
    // This is the "one-step diamond problem" in operational transfomration
    // see: http://www.codecommit.com/blog/java/understanding-and-applying-operational-transformation
    static _changeVariableByChangeset(args, deliver) {
        var fetchVariableVersionPromises = [],
            pgTableName = 'var_' + args.variableId.replace(new RegExp('-', 'g'), '_').toLowerCase(),
            insertVariableValueQuery,
            changeID,
            parentVersion,
            currentVersion,

            // the a in the simple one-step diamond problem
            // the changeset comming from the client, probably made on an older version of the variable (the server version migth be newr)
            clientChange = Changeset.unpack(args.change.changeset),

            // the b in the simple one-step diamond problem
            //the compound changes on the server side which are missing on the client site (the changeset from the client site does not consider this changes)
            serverChange,

            // the a' in the simple one-step diamond problem
            // this changeset will be applied to the current server sate and send to all clients
            transformedClientChange,

            // the b' in the simple one-step diamond problem
            // this changeset will be applied on the client who made the change that does not respect the serverChange
            transformedServerChange;


        fetchVariableVersionPromises.push(new Promise((resolve, reject) => {
            this.get({variableId: args.variableId, changeId: args.change.parentVersion}, (result) => {
                if(result.value) {
                    parentVersion = result.value;
                    resolve(result.value);
                } else {
                    reject();
                    deliver(new Error('error when fetching given parent version'));
                }
            });
        }));

        fetchVariableVersionPromises.push(new Promise((resolve, reject) => {
            this.get({variableId: args.variableId}, (result) => {
                if(result.value) {
                    currentVersion = result.value;
                    resolve(result.value);
                } else {
                    reject();
                    deliver(new Error('error when fetching current version'));
                }
            });
        }));

        Promise.all(fetchVariableVersionPromises).then(() => {

            serverChange = Changeset.fromDiff(diffEngine.diff_main(parentVersion, currentVersion));

            // This works because of the TP1 property of the transformAgainst function
            // see: https://en.wikipedia.org/wiki/Operational_transformation#Convergence_properties
            transformedClientChange = clientChange.transformAgainst(serverChange, false);
            transformedServerChange = serverChange.transformAgainst(clientChange, true);

            pgPool.connect((err, pgclient, releaseDBConnection) => {
                if(err) {
                    console.error(err)
                }

                insertVariableValueQuery = "INSERT INTO " + pgTableName + " (actor_id, time, value, delta) VALUES ('" + args.actorId + "', NOW(), '" + transformedClientChange.pack() + "', true) RETURNING change_id";
                pgclient.query(insertVariableValueQuery, (err, result) => {
                    if(err) {
                        console.error(err)
                    } else  {
                        changeID = result.rows[0].change_id;
                    }

                    if(err && err.message === 'relation "' + pgTableName + '" does not exist') {
                        releaseDBConnection();
                        deliver(new Error('variable with id "' + args.variableId + '" does not exist'));
                        return;
                    }

                    releaseDBConnection();
                    deliver(err || {id: changeID, clientId: args.clientId, transformedServerChange: transformedServerChange.pack(), transformedClientChange: transformedClientChange.pack()});
                });
            });
        });
    }

    static deleteAllVariables(deliver) {
        pgPool.connect((err, pgclient, releaseDBConnection) => {
            pgclient.query("SELECT * FROM pg_catalog.pg_tables WHERE tablename LIKE 'var_%'", (err, result) => {
                pgclient.query("DROP TABLE " + result.rows.map((t) => {return t.tablename}).join(','), (err, result) => {
                    releaseDBConnection();
                    deliver();
                });
            });
        });
    }
}

module.exports = Attribute;
