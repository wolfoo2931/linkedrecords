/* eslint-disable no-param-reassign */
import https from 'https';
import http from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-streams-adapter';
import SerializedChangeWithMetadata from '../../../../../src/attributes/abstract/serialized_change_with_metadata';
import IsSerializable from '../../../../../src/attributes/abstract/is_serializable';

const connections = {};
const channels = new Set<string>();

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

/**
 * Retrieve the set of all channel names currently tracked by the server.
 *
 * @returns The `Set<string>` containing every known channel name (the live set, not a copy).
 */
export async function getAllChannels(): Promise<Set<string>> {
  return channels;
}

/**
 * Attaches a Socket.IO-based WebSocket bus to the given HTTP server and Express-like app, wiring authentication/authorization and channel message handling.
 *
 * Initializes the Socket.IO server (optionally with a Redis adapter when REDIS_HOST is set), manages socket connections and subscriptions using the provided AccessControl, forwards incoming client messages to `onMessage`, and registers a helper on the Express response to send messages to a channel.
 *
 * @param httpServer - The HTTPS server to bind the WebSocket server to
 * @param app - An Express-like application; a `sendClientServerMessage` helper is attached to responses
 * @param accessControl - Object implementing authentication and authorization checks for connections, channel joins, and sends
 * @param onMessage - Callback invoked for validated incoming channel messages: (channel, message, request, userId)
 * @returns The helper function used to emit a message to a channel; it emits a `data` event to the channel with the provided body augmented by an `sseChannel` property set to the channel
 */
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

  io.of('/').adapter.on('create-room', (room) => channels.add(room));

  io.on('connection', async (socket) => {
    const request = socket?.request;
    let userId;

    if (socket.handshake.auth?.['token']) {
      const { token } = socket.handshake.auth;

      if (typeof token === 'string' && token.trim()) {
        request.headers.authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      }
    }

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