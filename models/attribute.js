'use strict';

var pg = require('pg'),
    uuid = require('uuid/v4'),
    pgPool = new pg.Pool();

var Attribute = function (args) {
    this.name = args.name;
    this.domain = args.domain;
};

Attribute.prototype.save = function(deliver) {
  var self = this;
  if(!self.name) {
      deliver(new Error('name argument must be present'));
      return;
  }

  if(typeof self.name !== 'string') {
      deliver(new Error('name argument must be a string'));
      return;
  }

  if(~self.name.indexOf('#')) {
      deliver(new Error('name argument must not include "#" character'));
      return;
  }

  pgPool.connect(function(err, pgclient, releaseDBConnection) {
      pgclient.query("SELECT name FROM attributes WHERE name='" + self.name + "' AND domain='" + self.domain + "'", (err, result) => {
          if(result.rows.length == 0) {
              pgclient.query("INSERT INTO attributes (name, domain) VALUES ('" + self.name + "', '" + self.domain + "')", (err, result) => {
                 releaseDBConnection();
                 deliver(null);
              });
          } else {
              deliver(new Error(self.name + ' attribute already exists for the domain: ' + self.domain));
          }
      });
  });
};

Attribute.deleteAllVariables = function(deliver) {
    pgPool.connect(function(err, pgclient, releaseDBConnection) {
        pgclient.query("SELECT * FROM pg_catalog.pg_tables WHERE tablename LIKE 'var_%'", (err, result) => {
            pgclient.query("DROP TABLE " + result.rows.map((t) => {return t.tablename}).join(','), (err, result) => {
                releaseDBConnection();
                deliver();
            });
        });
    });
}

Attribute.newVariable = function(args, deliver) {
    var variableID = uuid(),
        pgTableName = 'var_' + variableID.replace(new RegExp('-', 'g'), '_'),
        createVariableTableQuery,
        insertVariableValueQuery;

    if(!args.attribute) {
        deliver(new Error('attribute argument must be present'));
        return;
    }

    if(!args.actorId) {
        deliver(new Error('actorId argument must be present'));
        return;
    }

    if(!args.actorId.match(/^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i)) {
        deliver(new Error('actorId is "' + args.actorId + '" but it must be a valid uuid'));
        return;
    }

    pgPool.connect(function(err, pgclient, releaseDBConnection) {

        pgclient.query("SELECT name FROM attributes WHERE name='" + args.attribute + "' LIMIT 1", (err, result)  => {
          if(result.rows.length == 1) {

              createVariableTableQuery = "CREATE TABLE " + pgTableName + " (actor_id uuid, time timestamp, value TEXT, delta boolean);";
              insertVariableValueQuery = "INSERT INTO " + pgTableName + " (actor_id, time, value, delta) VALUES ('" + args.actorId + "', NOW(), '" + args.value + "', false)";

              pgclient.query(createVariableTableQuery + insertVariableValueQuery, (err, result) => {
                  deliver(variableID);
              });

          } else {
              deliver(new Error('attribute "' + args.attribute + '" does not exist'));
          }

          releaseDBConnection();
          return;
        });

    });
};

Attribute.getVariableByID = function(id, deliver) {
    var pgTableName = 'var_' + id.replace(new RegExp('-', 'g'), '_');

    pgPool.connect(function(err, pgclient, releaseDBConnection) {
        pgclient.query("SELECT value FROM " + pgTableName + " WHERE delta=false ORDER BY time DESC LIMIT 1", (err, result) => {
            releaseDBConnection();
            deliver({value: result.rows[0].value});
        });
    });
};

Attribute.changeVariable = function(args, deliver) {
    var pgTableName,
        insertVariableValueQuery,
        changeID = uuid();

    if(!args.variableId) {
        deliver(new Error('variableId argument must be present'));
        return;
    }

    pgTableName = 'var_' + args.variableId.replace(new RegExp('-', 'g'), '_');

    pgPool.connect(function(err, pgclient, releaseDBConnection) {
        insertVariableValueQuery = "INSERT INTO " + pgTableName + " (actor_id, time, value, delta) VALUES ('" + args.actorId + "', NOW(), '" + args.value + "', false)";
        pgclient.query(insertVariableValueQuery, (err, result) => {
            if(err && err.message === 'relation "' + pgTableName + '" does not exist') {
                deliver(new Error('variable with id "' + args.variableId + '" does not exist'));
                return;
            }
            releaseDBConnection();
            deliver();
        });
    });
};

Attribute.getVariableHistoryById = function(args, deliver) {
    var pgTableName;

    if(!args.variableId) {
        deliver(new Error('variableId argument must be present'));
        return;
    }

    pgTableName = 'var_' + args.variableId.replace(new RegExp('-', 'g'), '_');

    pgPool.connect(function(err, pgclient, releaseDBConnection) {
        pgclient.query("SELECT actor_id, time, value FROM " + pgTableName + " ORDER BY time DESC", (err, result) => {
            if(err && err.message === 'relation "' + pgTableName + '" does not exist') {
                deliver(new Error('variable with id "' + args.variableId + '" does not exist'));
                return;
            }

            releaseDBConnection();
            deliver(result.rows.map((row) => {
                row.actorId = row.actor_id;
                delete row.actor_id;
                return row;
            }));
        });
    });
};

module.exports = Attribute;
