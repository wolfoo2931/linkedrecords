import { Server } from 'http';
import express from 'express';
import faye from 'faye';
import cors from 'cors';
import SerializedChangeWithMetadata from '../attributes/abstract/serialized_change_with_metadata';
import attributeMiddleware, { getAttributeByParams } from './middleware/attribute';
import 'dotenv/config';

const app = express();
const server = new Server(app);
const bayeux = new faye.NodeAdapter({ mount: '/bayeux', timeout: 45 });

bayeux.attach(server);

app.use(cors());
app.use(express.static('staticfiles'));
app.use(express.json());
app.use(attributeMiddleware);

bayeux.getClient().subscribe('/uncommited/changes/attribute/*', async (changeWithMetadata: SerializedChangeWithMetadata<any>) => {
  const attribute = getAttributeByParams({
    query:
        {
          attributeId: changeWithMetadata.attributeId,
          actorId: changeWithMetadata.actorId,
          clientId: changeWithMetadata.clientId,
        },
  });

  try {
    const commitedChange = await attribute.change(changeWithMetadata);
    bayeux.getClient().publish(`/changes/attribute/${changeWithMetadata.attributeId}`, commitedChange);
  } catch (ex) {
    console.error(`error in /uncommited/changes/attribute/${changeWithMetadata.attributeId}`, ex);
  }
});

app.get('/attributes/:id', async (req, res) => {
  const result = await req.attribute.get();

  if (result instanceof Error) {
    console.error(`error in GET /attributes/${req.params.id}`, result.message);
    res.status(404).send({ error: result.message });
  } else {
    res.send(result);
  }
});

app.post('/attributes/:attributeId', async (req, res) => {
  await req.attribute.create(req.body.value);
  const result = await req.attribute.get();

  if (result instanceof Error) {
    console.error(`error in GET /attributes/${req.params.attributeId}`, result.message);
    res.status(404).send({ error: result.message });
  } else {
    res.send(result);
  }
});

server.listen(process.env['PORT'] || 3000);
