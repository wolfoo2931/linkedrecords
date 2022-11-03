export interface IsSubscribable {
  subscribe(url: string, channel: string, handler: (data: any) => any);
  unsubscribeAll();
}

export default class ServerSideEvents implements IsSubscribable {
  subscriptions = {};

  connetions = {};

  isPaused: boolean = false;

  messagesWhilePaused: { cb: (data: any) => any, data: any }[] = [];

  tabId: string = (Math.random() + 1).toString(36).substring(7);

  public getEventSourceAsync(url: URL) {
    if (!url.searchParams.has('tabId')) {
      url.searchParams.append('tabId', this.tabId);
    }

    return new Promise((resolve, reject) => {
      const source = new EventSource(url.toString(), {
        withCredentials: true,
      });

      source.onerror = reject;
      source.onopen = () => {
        resolve(source);
      };
    });
  }

  public async subscribe(url: string, channel: string, handler: (data: any) => any) {
    const parsedUrl: URL = new URL(url);
    const subId = `${parsedUrl.origin}-${channel}`;

    if (!parsedUrl.searchParams.has('tabId')) {
      parsedUrl.searchParams.append('tabId', this.tabId);
    }

    await this.ensureConnection(parsedUrl.origin);
    await fetch(parsedUrl.toString(), {
      credentials: 'include',
    });

    this.subscriptions[subId] = this.subscriptions[subId] || [];
    this.subscriptions[subId].push(handler);
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

  private async ensureConnection(origin) {
    const url = new URL(origin);
    url.pathname = '/server-sent-events';

    if (!this.connetions[url.origin]) {
      try {
        this.connetions[url.origin] = await this.getEventSourceAsync(url);
      } catch (ex) {
        this.connetions[url.origin] = await this.getEventSourceAsync(url);
      }

      this.connetions[url.origin].onmessage = (event) => {
        const data = JSON.parse(event.data);
        const { sseChannel } = data;

        if (!sseChannel) {
          return;
        }

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
      };
    }

    return this.connetions[origin];
  }
}
