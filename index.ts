'use strict';

import { Attribute } from './models/attribute';
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
    const attribute = new Attribute(id, actorId, clientId);
    const commitedChange = await attribute.change(change);
    bayeux.getClient().publish('/changes/attribute/' + id, commitedChange);
});

app.get('/attributes/:id', async (req, res) => {
    const attribute = new Attribute(req.params.id, undefined, undefined);
    const result = await attribute.get();

    if(result instanceof Error) {
        res.status(404).send({error: result.message});
    } else {
        res.send(result);
    }
});

app.use(express.static('staticfiles'));

server.listen(process.env.PORT || 3000);


