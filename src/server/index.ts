'use strict';

import { LongTextAttribute, PsqlStorage } from '../attributes/long_text/server';
import { Server } from 'http';
import express from 'express';
import faye from 'faye';
import cors from 'cors';
import 'dotenv/config';

const app = express();
const server = new Server(app);
const bayeux = new faye.NodeAdapter({mount: '/bayeux', timeout: 45});
const storage = new PsqlStorage();

bayeux.attach(server);

app.use(cors());
app.use(express.json())

function getAttributeClassByAttributeId(id: string) : any {
    const attributeTypes = [ LongTextAttribute ]

    const [attributeTypePrefix] = id.split('-');
    const attributeClass = attributeTypes.find(c => c.DATA_TYPE_PREFIX === attributeTypePrefix);

    return attributeClass;
}

bayeux.getClient().subscribe('/uncommited/changes/attribute/*', async ({ id, change, actorId, clientId }) => {
    const attributeClass = getAttributeClassByAttributeId(id);

    try {
        if(!attributeClass) {
            throw `Server is unkown of Attribute Type Prefix for id ${id}`
        }

        const starTime = Date.now();
        const attribute = new attributeClass(id, clientId, actorId, storage);
        const commitedChange = await attribute.change(change.changeset, change.parentVersion);
        bayeux.getClient().publish('/changes/attribute/' + id, commitedChange);
        console.log('Change attribute (' + id + ') finished in ', Date.now() - starTime);
    } catch(ex) {
        console.error(`error in /uncommited/changes/attribute/${id}`, ex);
    }
});

app.get('/attributes/:id', async (req, res) => {
    const attributeClass = getAttributeClassByAttributeId(req.params.id);

    if(!attributeClass) {
        res.status(404).send({error: `Server is unkown of Attribute Type Prefix for id ${req.params.id}`});
        return;
    }

    const attribute = new attributeClass(req.params.id, req.params.clientId, req.params.actorId, storage);
    const result = await attribute.get();

    if(result instanceof Error) {
        console.error(`error in GET /attributes/${req.params.id}`, result.message);
        res.status(404).send({error: result.message});
    } else {
        res.send(result);
    }
});

app.post('/attributes/:id', async (req, res) => {
    const attributeClass = getAttributeClassByAttributeId(req.params.id);

    if(!attributeClass) {
        res.status(404).send({error: `Server is unkown of Attribute Type Prefix for id ${req.params.id}`});
        return;
    }

    const attribute = new attributeClass(req.params.id, req.body.clientId, req.body.actorId, storage);
    await attribute.create(req.body.value);
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


