'use strict';

var pg = require('pg'),
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

  pgPool.connect(function(err, pgclient, releaseConnection) {

console.log("SELECT name FROM attributes WHERE name='" + self.name + "' AND domain='" + self.domain + "'");
      pgclient.query("SELECT name FROM attributes WHERE name='" + self.name + "' AND domain='" + self.domain + "'", (err, result) => {
          if(result.rows.length == 0) {
              pgclient.query("INSERT INTO attributes (name, domain) VALUES ('" + self.name + "', '" + self.domain + "')", (err, result) => {
                 releaseConnection();
                 deliver(null);
              });
          } else {
              deliver(new Error(self.name + ' attribute already exists for the domain: ' + self.domain));
          }
      });
  });
};

module.exports = Attribute;
