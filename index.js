'use strict';

var Attribute = require('./models/attribute.js'),
    app = require('express')(),
    server = require('http').Server(app),
    faye = require('faye'),
    bayeux = new faye.NodeAdapter({mount: '/bayeux', timeout: 45});

bayeux.attach(server);

bayeux.getClient().subscribe('/uncommited/changes/variable/*', function(change) {
    //setTimeout(() => {
        Attribute.changeVariable(change, (commitedChange) => {
            console.log(commitedChange);
            bayeux.getClient().publish('/changes/variable/' + change.variableId, commitedChange);
        });
    //}, 1000);
});

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/variables/:id', function (req, res) {
    console.log('get variable with id ' + req.params.id);

    Attribute.getVariable({variableId: req.params.id}, (result) => {
        if(result instanceof Error) {
            res.status(404).send({error: result.message});
        } else {
            res.send(result);
        }
    })
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
