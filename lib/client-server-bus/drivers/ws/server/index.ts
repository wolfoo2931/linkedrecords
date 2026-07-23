/* eslint-disable no-param-reassign */
import https from 'https';
import http from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-streams-adapter';
import SerializedChangeWithMetadata from '../../../../../src/records/abstract/serialized_change_with_metadata';
import IsSerializable from '../../../../../src/records/abstract/is_serializable';

const connections = {};
const channels = new Set<string>();

const channelsResolver = Promise.withResolvers();

type MessageHandler<ChangeType extends IsSerializable> = (
  channel: string,
  message: SerializedChangeWithMetadata<ChangeType>,
  request: http.IncomingMessage,
  userId: string
) => void;

export interface AccessControl {
  verifyAuthenticated(
    request: http.IncomingMessage
  ): Promise<string>;

  verifyAuthorizedChannelJoin(
    userId: string,
    channel: string,
    request: http.IncomingMessage,
    readToken?: string,
  ): Promise<boolean>;

  verifyAuthorizedSend(
    userId: string,
    channel: string,
    request: http.IncomingMessage,
  ): Promise<boolean>;
}

export async function getAllChannels(): Promise<Set<string>> {
  await channelsResolver.promise;
  return channels;
}

export default async function clientServerBus(
  httpServer: https.Server,
  app: any,
  accessControl: AccessControl,
  onMessage: MessageHandler<any>,
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

  io.fetchSockets().then((sockets) => {
    sockets.forEach((socket) => {
      socket.rooms.forEach((room) => channels.add(room));
    });

    console.log(`found ${channels.size} socket.io channels`);
    channelsResolver.resolve(undefined);
  }).catch((ex) => {
    channelsResolver.reject(ex);
  });

  io.of('/').adapter.on('create-room', (room) => channels.add(room));
  io.of('/').adapter.on('delete-room', (room) => channels.delete(room));

  // Authentication runs as socket.io middleware: it completes BEFORE the
  // connection is acknowledged to the client. Doing it inside the
  // 'connection' handler instead would open a race — the client's first
  // 'subscribe' can arrive while the (async) authentication is still
  // running, before the event handlers below are registered, and gets
  // silently dropped so its ack never fires.
  io.use(async (socket, next) => {
    const request = socket.request as any;

    if (socket.handshake.auth?.['token']) {
      const { token } = socket.handshake.auth;

      if (typeof token === 'string' && token.trim()) {
        request.headers.authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      }
    }

    try {
      const userId = await accessControl.verifyAuthenticated(request);

      if (!userId) {
        next(new Error('unauthorized'));
        return;
      }

      socket.data.userId = userId;
      next();
    } catch (ex) {
      request.log?.info(`User not authenticated: ${(ex as Error).message}`);
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const request = socket?.request;
    const { userId } = socket.data;

    if (!connections[socket.id]) {
      connections[socket.id] = { socket, userId };

      socket.on('subscribe', async ({ channel, readToken }, callback) => {
        const isAuthorizedToJoin = await accessControl.verifyAuthorizedChannelJoin(
          userId,
          channel,
          request,
          readToken,
        );

        if (!channel) {
          callback({ status: 'invalid channel' });
        } else if (isAuthorizedToJoin) {
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
