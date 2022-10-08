/* eslint-disable no-param-reassign */

import { v4 as uuid } from 'uuid';

const headers = {
  Connection: 'keep-alive',
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
};

const connections = {};
const subscribers = {};

export default function serverSentEvents() {
  return (request, response, next) => {
    if (request.path === '/server-sent-events' && request.method === 'GET') {
      if (!request.signedCookies.sseClientId) {
        const clientId = uuid(); // TODO: secure rand number
        response.cookie('sseClientId', clientId, { signed: true, httpOnly: true });
        response.send({ status: 'retry with id' });
      } else if (!request.query.tabId || request.query.tabId.length < 2) {
        response
          .status(422)
          .send({ status: 'provide tabId as query parameter to subscribe to server sent events' });
      } else if (connections[`${request.signedCookies.sseClientId}-${request.query.tabId}`]) {
        response
          .status(200)
          .send({ status: 'already subscribed' });
      } else {
        const connectionId = `${request.signedCookies.sseClientId}-${request.query.tabId}`;
        response.writeHead(200, headers);
        response.flushHeaders();
        request.on('close', () => { delete connections[connectionId]; });
        request.on('finish', () => { delete connections[connectionId]; });
        request.on('timeout', () => { delete connections[connectionId]; });

        connections[connectionId] = response;
      }
    }

    response.subscribeSEE = (channel: string) => {
      if (!request.query.tabId || request.query.tabId.length < 2) {
        throw new Error('provide tabId as query parameter to subscribe to server sent events');
      } else if (!request.signedCookies.sseClientId) {
        throw new Error('Server Send Events is not initialized');
      }

      const connectionId = `${request.signedCookies.sseClientId}-${request.query.tabId}`;

      subscribers[channel] = subscribers[channel] || [];

      if (!subscribers[channel].find((sub) => sub.connectionId === connectionId)) {
        subscribers[channel].push({ connectionId, response, eventId: 0 });
      }
    };

    response.sendSEE = (channel: string, body: any) => {
      const bodyWithCannel = {
        ...body,
        sseChannel: channel,
      };

      if (subscribers[channel]) {
        subscribers[channel].forEach((subscription) => {
          if (connections[subscription.connectionId]) {
            connections[subscription.connectionId].write(`id: ${subscription.eventId}\n`);
            connections[subscription.connectionId].write(`data: ${JSON.stringify(bodyWithCannel)}\n\n`);
            subscription.eventId += 1;
          }
        });
      }
    };

    next();
  };
}
