/* eslint-disable import/no-cycle */
import { io } from 'socket.io-client';
import { IsSubscribable } from '../../../client';

export default class ClientServerBus implements IsSubscribable {
  subscriptions = {};

  connetions = {};

  connetionsInEstablishment = {};

  isPaused: boolean = false;

  messagesWhilePaused: { cb: (data: any) => any, data: any }[] = [];

  public async subscribe(url: string, channel: string, handler: (data: any) => any)
    : Promise<[string, (data: any) => any]> {
    const parsedUrl: URL = new URL(url);
    const subId = `${parsedUrl.origin}-${channel}`;

    await this.ensureConnection(parsedUrl.origin);

    const subResult = await new Promise((resolve) => {
      this.connetions[parsedUrl.origin].emit('subscribe', { channel }, resolve);
    }) as any;

    if (subResult.status === 'unauthorized') {
      throw new Error('unauthorized');
    }

    if (subResult.status !== 'subscribed') {
      throw new Error(`unkown error when subscribing to ${channel}`);
    }

    this.subscriptions[subId] = this.subscriptions[subId] || [];
    this.subscriptions[subId].push(handler);

    return [subId, handler];
  }

  public async unsubscribe([subId, handler]: [string, (data: any) => any]) {
    if (this.subscriptions[subId]) {
      this.subscriptions[subId] = this.subscriptions[subId].filter((h) => h !== handler);
    }
  }

  public unsubscribeAll() {
    Object.values(this.connetions).forEach((connection: any) => {
      connection.close();
    });

    this.connetions = {};
  }

  public pauseNotification() {
    this.isPaused = true;
  }

  public unpauseNotification() {
    this.messagesWhilePaused.forEach(({ cb, data }) => {
      cb(data);
    });

    this.messagesWhilePaused = [];
  }

  private static getWSAsync(url: URL) {
    return new Promise((resolve, reject) => {
      const socket = io(url.origin, {
        withCredentials: true,
        path: url.pathname,
        transports: ['websocket'],
      });

      socket.on('connect', () => {
        resolve(socket);
      });

      socket.on('connect_error', reject);
    });
  }

  private async ensureConnection(origin) {
    const url = new URL(origin);
    url.pathname = '/ws';

    if (this.connetionsInEstablishment[url.origin]) {
      const connection = await this.connetionsInEstablishment[url.origin];
      return connection;
    }

    if (!this.connetions[url.origin]) {
      this.connetionsInEstablishment[url.origin] = ClientServerBus.getWSAsync(url);
      this.connetions[url.origin] = await this.connetionsInEstablishment[url.origin];

      this.connetions[url.origin].on('data', (data) => {
        const { sseChannel } = data;

        if (!sseChannel) {
          return;
        }

        // eslint-disable-next-line no-param-reassign
        delete data.sseChannel;

        const subscriptions = this.subscriptions[`${url.origin}-${sseChannel}`];

        if (subscriptions) {
          subscriptions.forEach((cb) => {
            if (this.isPaused) {
              this.messagesWhilePaused.push({ cb, data });
            } else {
              cb(data);
            }
          });
        }
      });
    }

    return this.connetions[origin];
  }
}
