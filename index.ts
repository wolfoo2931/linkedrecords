'use strict';

import { Attribute } from './models/attribute.js';
import { Server } from 'http';
import express from 'express';
import faye from 'faye';
import 'dotenv/config';

const app = express();
const server = new Server(app);
const bayeux = new faye.NodeAdapter({mount: '/bayeux', timeout: 45});

bayeux.attach(server);

app.use(function(req, res, next) {
    //FIXME: be more restrictive
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

bayeux.getClient().subscribe('/uncommited/changes/variable/*', change => {
    var startTime = Date.now();

    Attribute.set(change).then(commitedChange => {
        bayeux.getClient().publish('/changes/variable/' + change.id, commitedChange);
        console.log('    processed in: ' + (Date.now() - startTime) + ' msec');
    });
});

app.get('/variables/:id', function (req, res) {
    var startTime = Date.now();
    Attribute.get({ id: req.params.id }).then(result => {
        if(result instanceof Error) {
            res.status(404).send({error: result.message});
        } else {
            res.send(result);
            console.log('    processed in: ' + (Date.now() - startTime) + ' msec');
        }
    })
});

app.use(express.static('staticfiles'));

server.listen(process.env.PORT || 3000);


