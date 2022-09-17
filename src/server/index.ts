'use strict';

import attributeMiddleware, { getAttributeByParams } from './middleware/attribute';
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
app.use(express.static('staticfiles'));
app.use(express.json());
app.use(attributeMiddleware);

bayeux.getClient().subscribe('/uncommited/changes/attribute/*', async ({ id, change, actorId, clientId }) => {

    const attribute = getAttributeByParams({ params: { id, actorId, clientId } });

    try {
        const commitedChange = await attribute.change(change.changeset, change.parentVersion);
        bayeux.getClient().publish('/changes/attribute/' + id, commitedChange);
    } catch(ex) {
        console.error(`error in /uncommited/changes/attribute/${id}`, ex);
    }
});

app.get('/attributes/:id', async (req, res) => {
    const result = await req.attribute.get();

    if(result instanceof Error) {
        console.error(`error in GET /attributes/${req.params.id}`, result.message);
        res.status(404).send({error: result.message});
    } else {
        res.send(result);
    }
});

app.post('/attributes/:id', async (req, res) => {
    await req.attribute.create(req.body.value);
    const result = await req.attribute.get();

    if(result instanceof Error) {
        console.error(`error in GET /attributes/${req.params.id}`, result.message);
        res.status(404).send({error: result.message});
    } else {
        res.send(result);
    }
});

server.listen(process.env.PORT || 3000);


