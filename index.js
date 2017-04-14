'use strict';

var Attribute = require('./models/attribute.js'),
    app = require('express')(),
    server = require('http').Server(app),
    faye = require('faye'),
    bayeux = new faye.NodeAdapter({mount: '/bayeux', timeout: 45});

bayeux.attach(server);

bayeux.getClient().subscribe('/changes/uncommited/variable/*', function(message) {
    console.log('Got a message: ' + message);
});

app.get('/concepts/instances', function (req, res) {
    res.send(attr);
});

server.listen(3000);

console.log('running');

// new Attribute({
//     name: 'content',
//     representationRule: '{{string}}',
//     domain: 'global.specify.io/domains/blog',
//     revisioning: {active: true},
// }).save(() => {})
// Attribute.newVariable({
//     actorId: '698aafe8-dcd5-4ced-b969-ffc34a43f645',
//     belonging: {concept: 'blog', id: '4711'},
//     attribute: 'content',
//     value: 'initial content'
// }, () => {})
