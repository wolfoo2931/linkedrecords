/* eslint-disable no-param-reassign */
import https from 'https';
import http from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-streams-adapter';

const connections = {};

export interface AccessControl {
  verifyAuthenticated(
    request: http.IncomingMessage
  ): Promise<string>;

  verifyAuthorizedChannelJoin(
    userId: string,
    channel: string,
    request: http.IncomingMessage,
  ): Promise<boolean>;

  verifyAuthorizedSend(
    userId: string,
    channel: string,
    request: http.IncomingMessage,
  ): Promise<boolean>;
}

export default async function clientServerBus(
  httpServer: https.Server,
  app: any,
  accessControl: AccessControl,
  onMessage: (channel: string, message: any, request: http.IncomingMessage, userId: string) => void,
) {
  const wsOptions: any = {
    path: '/ws',
    cookie: true,
  };

  if (process.env['REDIS_HOST']) {
    const redisClient = createClient({
      username: process.env['REDIS_USERNAME'],
      password: process.env['REDIS_PASSWORD'],
      socket: {
        host: process.env['REDIS_HOST'],
        port: 6379,
      },
    });
    await redisClient.connect();
    wsOptions.adapter = createAdapter(redisClient);
  }

  const io = new Server(httpServer, wsOptions);

  const sendClientServerMessage = (channel: string, body: any) => {
    io.to(channel).emit('data', {
      ...body,
      sseChannel: channel,
    });
  };

  io.on('connection', async (socket) => {
    const request = socket?.request;
    let userId;

    try {
      userId = await accessControl.verifyAuthenticated(request);
    } catch (ex) {
      request.log.info(`User not authenticated: ${(ex as Error).message}`);
      throw ex;
    }

    if (!userId) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.disconnect(true);
      return;
    }

    if (!connections[socket.id]) {
      connections[socket.id] = { socket, userId };

      socket.on('subscribe', async ({ channel }, callback) => {
        if (!channel) {
          callback({ status: 'invalid channel' });
        } else if (await accessControl.verifyAuthorizedChannelJoin(userId, channel, request)) {
          socket.join(channel);
          callback({ status: 'subscribed' });
        } else {
          callback({ status: 'unauthorized' });
        }
      });

      socket.on('message', async ({ channel, message }, callback) => {
        if (!channel) {
          callback({ status: 'invalid channel' });
        } else if (!message) {
          callback({ status: 'invalid message' });
        } else if (await accessControl.verifyAuthorizedSend(userId, channel, request)) {
          onMessage(channel, message, request, userId);
          callback({ status: 'delivered' });
        } else {
          callback({ status: 'unauthorized' });
        }
      });
    }
  });

  io.engine.on('connection_error', (err) => {
    console.log('websocket connection error', err);
  });

  app.use((request, response, next) => {
    response.sendClientServerMessage = sendClientServerMessage;
    next();
  });

  return sendClientServerMessage;
}
