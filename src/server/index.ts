import { Server } from 'http';
import express from 'express';
import cors from 'cors';
import SerializedChangeWithMetadata from '../attributes/abstract/serialized_change_with_metadata';
import ServerSideEvents from './server-side-events';
import attributeMiddleware from './middleware/attribute';
// import authentication from './middleware/authentication';
import 'dotenv/config';

const app = express();
const server = new Server(app);
const serverSideEvents = new ServerSideEvents();

app.use('/example', express.static('example'));
app.use(cors());
app.use(express.json());
// app.use(authentication());
app.use(attributeMiddleware({ ignorePattern: /\/example/ }));

app.get('/attributes/:id', async (req, res) => {
  const result = await req.attribute.get();

  if (result instanceof Error) {
    console.error(`error in GET /attributes/${req.params.id}`, result.message);
    res.status(404).send({ error: result.message });
  } else {
    res.send(result);
  }
});

app.get('/attribute-changes/:attributeId', async (req, res) => {
  serverSideEvents.subscribe(req.params.attributeId, req, res);
});

app.patch('/attributes/:attributeId', async (req, res) => {
  const parsedChange: SerializedChangeWithMetadata<any> = req.body;
  const commitedChange: SerializedChangeWithMetadata<any> = await req.attribute.change(
    parsedChange,
  );

  serverSideEvents.send(req.params.attributeId, commitedChange);
  res.status(200);
  res.send();
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
