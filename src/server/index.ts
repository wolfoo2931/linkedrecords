'use strict';

import { LongTextAttribute } from '../attributes/long_text/server';
import { Server } from 'http';
import express from 'express';
import faye from 'faye';
import cors from 'cors';
import 'dotenv/config';

const app = express();
const server = new Server(app);
const bayeux = new faye.NodeAdapter({mount: '/bayeux', timeout: 45});

bayeux.attach(server);

app.use(cors());

bayeux.getClient().subscribe('/uncommited/changes/attribute/*', async ({id, change, actorId, clientId}) => {
    try {
        const attribute = new LongTextAttribute(id, clientId, actorId);
        const commitedChange = await attribute.change(change.changeset, change.parentVersion);
        bayeux.getClient().publish('/changes/attribute/' + id, commitedChange);
    } catch(ex) {
        console.error(`error in /uncommited/changes/attribute/${id}`, ex);
    }
});

app.get('/attributes/:id', async (req, res) => {
    const attribute = new LongTextAttribute(req.params.id, req.params.clientId, req.params.actorId);
    const result = await attribute.get();

    if(result instanceof Error) {
        console.error(`error in GET /attributes/${req.params.id}`, result.message);
        res.status(404).send({error: result.message});
    } else {
        res.send(result);
    }
});

app.use(express.static('staticfiles'));

server.listen(process.env.PORT || 3000);


