import { Server } from 'http';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import SerializedChangeWithMetadata from '../attributes/abstract/serialized_change_with_metadata';
import serverSentEvents from '../../lib/server-side-events/server';
import attributeMiddleware from './middleware/attribute';
import Fact from '../facts/server';

// import authentication from './middleware/authentication';
import 'dotenv/config';

const app = express();
const server = new Server(app);
Fact.initDB();

app.use('/example', express.static('example'));
app.use(morgan('tiny', { skip: (req) => req.method === 'OPTIONS' }));
app.use(cors({ origin: '*' }));
app.use(cookieParser(process.env['AUTH_COOKIE_SIGNING_SECRET']));
app.use(express.json());
app.use(serverSentEvents());
// app.use(authentication());
app.use('/attributes', attributeMiddleware());

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

app.get('/attributes/:id', async (req, res) => {
  const result = await req.attribute.get();

  if (result instanceof Error) {
    console.error(`error in GET /attributes/${req.params.id}`, result.message);
    res.status(404).send({ error: result.message });
  } else {
    res.send(result);
  }
});

app.get('/attributes/:attributeId/changes', async (req, res) => {
  res.subscribeSEE(req.params.attributeId);
  res.send({ status: 'ok' });
});

app.patch('/attributes/:attributeId', async (req, res) => {
  const parsedChange: SerializedChangeWithMetadata<any> = req.body;
  const commitedChange: SerializedChangeWithMetadata<any> = await req.attribute.change(
    parsedChange,
  );

  res.sendSEE(req.params.attributeId, commitedChange);
  res.status(200);
  res.send();
});

app.get('/facts', async (req, res) => {
  const subject = req.query.subject ? JSON.parse(req.query.subject) : undefined;
  const predicate = req.query.predicate ? JSON.parse(req.query.predicate) : undefined;
  const object = req.query.object ? JSON.parse(req.query.object) : undefined;

  const facts = await Fact.findAll({
    subject,
    predicate,
    object,
  });

  res.status(200);
  res.send(facts);
});

app.post('/facts', async (req, res) => {
  const { subject, predicate, object } = req.body;
  const fact = new Fact(subject, predicate, object);
  await fact.save();

  res.status(200);
  res.send();
});

app.delete('/facts', async (req, res) => {
  await Fact.deleteAll();

  res.status(200);
  res.send();
});

server.listen(process.env['PORT'] || 3000);
