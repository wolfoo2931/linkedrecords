'use strict';

import { Attribute } from './models/attribute';
import { Server } from 'http';
import express from 'express';
import faye from 'faye';
import 'dotenv/config';

const app = express();
const server = new Server(app);
const bayeux = new faye.NodeAdapter({mount: '/bayeux', timeout: 45});

bayeux.attach(server);

app.use((req, res, next) => {
    //FIXME: be more restrictive
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

bayeux.getClient().subscribe('/uncommited/changes/variable/*', async ({id, change, actorId, clientId}) => {
    const startTime = Date.now();
    const commitedChange = await Attribute.change(id, change, actorId, clientId);

    bayeux.getClient().publish('/changes/variable/' + id, commitedChange);

    console.log('    processed in: ' + (Date.now() - startTime) + ' msec');
});

app.get('/variables/:id', async (req, res) => {
    const startTime = Date.now();
    const result = await Attribute.get(req.params.id);

    if(result instanceof Error) {
        res.status(404).send({error: result.message});
    } else {
        res.send(result);
        console.log('    processed in: ' + (Date.now() - startTime) + ' msec');
    }
});

app.use(express.static('staticfiles'));

server.listen(process.env.PORT || 3000);


