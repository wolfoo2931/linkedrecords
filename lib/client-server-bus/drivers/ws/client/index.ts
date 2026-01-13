import {
  io,
  ManagerOptions,
  Socket,
  SocketOptions,
} from 'socket.io-client';

export default class ClientServerBus {
  subscriptions = {};

  connections = {};

  connectionsInEstablishment = {};

  isPaused: boolean = false;

  connectionInterruptedSubscribers: ((error?: any) => void)[] = [];

  messagesWhilePaused: { cb: (data: any) => any, data: any }[] = [];

  getBearerToken?: () => Promise<string | null>;

  constructor(getBearerToken?: () => Promise<string | null>) {
    this.getBearerToken = getBearerToken;
  }

  public subscribeConnectionInterrupted(sub: (error?: any) => void): void {
    this.connectionInterruptedSubscribers.push(sub);
  }

  public async subscribe(url: string, channel: string, readToken, handler: (data: any) => any)
    : Promise<[string, (data: any) => any]> {
    const parsedUrl: URL = new URL(url);
    const subId = `${parsedUrl.origin}-${channel}`;
    const connection = await this.ensureConnection(parsedUrl.origin);

    const subResult = await new Promise((resolve) => {
      connection.emit('subscribe', { channel, readToken }, resolve);
    }) as any;

    if (subResult.status === 'unauthorized') {
      throw new Error('unauthorized');
    }

    if (subResult.status !== 'subscribed') {
      throw new Error(`unknown error when subscribing to ${channel}`);
    }

    this.subscriptions[subId] = this.subscriptions[subId] || [];
    this.subscriptions[subId].push(handler);

    return [subId, handler];
  }

  public async send(url: string, channel: string, message: object) {
    const parsedUrl: URL = new URL(url);
    const connection = await this.ensureConnection(parsedUrl.origin);

    const sendResult = await new Promise((resolve) => {
      connection.emit('message', { channel, message }, resolve);
    }) as any;

    if (sendResult.status === 'unauthorized') {
      throw new Error('unauthorized');
    }

    if (sendResult.status !== 'delivered') {
      throw new Error(`unknown error when sending message to ${channel}`);
    }
  }

  public async unsubscribe([subId, handler]: [string, (data: any) => any]) {
    if (this.subscriptions[subId]) {
      this.subscriptions[subId] = this.subscriptions[subId].filter((h) => h !== handler);
    }
  }

  public unsubscribeAll() {
    Object.values(this.connections).forEach((connection: any) => {
      connection.close();
    });

    this.connections = {};
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

  private async getWSAsync(url: URL): Promise<Socket<any, any>> {
    const opt: Partial<ManagerOptions & SocketOptions> = {
      withCredentials: true,
      path: url.pathname,
      transports: ['websocket'],
    };

    if (this.getBearerToken) {
      const token = await this.getBearerToken();

      if (token) {
        opt.auth = {
          token: `Bearer ${token}`,
        };
      }
    }

    return new Promise((resolve, reject) => {
      const socket = io(url.origin, opt);

      socket.on('connect', () => {
        resolve(socket);
      });

      socket.on('error', (error) => {
        console.log('==> websocket error', error);
        this.connectionInterruptedSubscribers.forEach((sub) => {
          sub(error);
        });
      });

      socket.on('disconnect', (reason) => {
        const willTryToReconnectReasons = ['ping timeout', 'transport close', 'transport error'];

        if (willTryToReconnectReasons.includes(reason)) {
          console.log('Connection disconnected. Socket.io will try to reconnect...');
          return;
        }

        this.connectionInterruptedSubscribers.forEach((sub) => {
          sub(new Error(`Websocket connection closed because: ${reason}`));
        });
      });

      socket.io.on('reconnect_error', (error) => {
        this.connectionInterruptedSubscribers.forEach((sub) => {
          console.log(`Websocket reconnect error: ${error}`);
          sub(new Error(`Websocket reconnect error: ${error}`));
        });
      });

      socket.io.on('reconnect_failed', () => {
        this.connectionInterruptedSubscribers.forEach((sub) => {
          console.log('Websocket reconnect failed!');
          sub(new Error('Websocket reconnect failed!'));
        });
      });

      socket.on('connect_error', reject);
    });
  }

  private async ensureConnection(origin) {
    const url = new URL(origin);
    url.pathname = '/ws';

    if (this.connectionsInEstablishment[url.origin]) {
      const connection = await this.connectionsInEstablishment[url.origin];
      return connection;
    }

    if (!this.connections[url.origin]) {
      this.connectionsInEstablishment[url.origin] = this.getWSAsync(url);
      this.connections[url.origin] = await this.connectionsInEstablishment[url.origin];

      this.connections[url.origin].on('data', (data) => {
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

    return this.connections[origin];
  }
}
