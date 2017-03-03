'use strict';

var pg = require('pg'),
    pgPool = new pg.Pool({max: 10, idleTimeoutMillis: 30000});

var Attribute = function (args, deliver) {
    var self = this,
        deliver = deliver || ((err, attr) => {});

    if(!args.name) {
        deliver('name argument must be present');
        return;
    }

    if(typeof args.name !== 'string') {
        deliver('name argument must be a string');
        return;
    }

    pgPool.connect(function(err, pgclient, done) {
        pgclient.query("SELECT name FROM attributes WHERE name='" + args.name + "'", (err, result) => {
            if(result.rows.length == 0) {
                pgclient.query("INSERT INTO attributes (name) VALUES ('" + args.name + "')", (err, result) => {
                   done();
                   deliver(null, self);
                });
            } else {
                deliver(args.name + ' attribute already exists for the domain: ' + args.domain, null);
            }
        });
    });
};

module.exports = Attribute;
