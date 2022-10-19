import { Server } from 'http';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import serverSentEvents from '../../lib/server-side-events/server';
import attributeMiddleware from './middleware/attribute';
import Fact from '../facts/server';
import factsController from './controllers/facts_controller';
import attributesController from './controllers/attributes_controller';

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

app.post('/attributes/:attributeId', attributesController.create);
app.get('/attributes/:id', attributesController.get);
app.get('/attributes/:attributeId/changes', attributesController.subsribe);
app.patch('/attributes/:attributeId', attributesController.update);

app.get('/facts', factsController.index);
app.post('/facts', factsController.create);
app.delete('/facts', factsController.deleteAll);

server.listen(process.env['PORT'] || 3000);
