/* eslint-disable no-param-reassign */

import { v4 as uuid } from 'uuid';

export default class ServerSideEvents {
  subscribers: { id: string, eventId: number, response: any }[];

  constructor() {
    this.subscribers = [];
  }

  subscribe(channel: string, request: any, response: any) {
    const subscriberId = uuid();
    const headers = {
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    };

    response.writeHead(200, headers);

    if (!this.subscribers[channel]) {
      this.subscribers[channel] = [];
    }

    this.subscribers[channel].push({
      id: subscriberId,
      eventId: 0,
      response,
    });

    request.on('close', () => {
      this.subscribers[channel] = this.subscribers[channel]
        .filter((sub) => sub.id !== subscriberId);
    });
  }

  send(channel: string, body: object) {
    if (this.subscribers[channel]) {
      this.subscribers[channel].forEach((subscriber) => {
        subscriber.response.write(`id: ${subscriber.eventId}\n`);
        subscriber.response.write(`data: ${JSON.stringify(body)}\n\n`);

        subscriber.eventId += 1;
      });
    }
  }
}
