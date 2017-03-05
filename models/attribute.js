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
        pgTableName = 'var_' + variableID.replace(new RegExp('-', 'g'), '_');

    pgPool.connect(function(err, pgclient, releaseDBConnection) {
        pgclient.query("CREATE TABLE " + pgTableName + " (user_id uuid, time timestamp, value TEXT, delta boolean); INSERT INTO " + pgTableName + " (user_id, time, value, delta) VALUES ('" + args.userID + "', NOW(), '" + args.value + "', false)", (err, result) => {
            releaseDBConnection();
            deliver(variableID);
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
}

module.exports = Attribute;
