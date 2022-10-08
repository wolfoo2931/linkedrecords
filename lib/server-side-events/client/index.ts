export interface IsSubscribable {
  subscribe(url: string, channel: string, handler: (data: any) => any);
  unsubscribeAll();
}

function getTabId() {
  if (!sessionStorage['tabId']) {
    sessionStorage['tabId'] = (Math.random() + 1).toString(36).substring(7);
  }

  return sessionStorage['tabId'];
}

function getEventSourceAsync(url: URL) {
  if (!url.searchParams.has('tabId')) {
    url.searchParams.append('tabId', getTabId());
  }

  return new Promise((resolve, reject) => {
    const source = new EventSource(url.toString());

    source.onerror = reject;
    source.onopen = () => resolve(source);
  });
}

export default class ServerSideEvents implements IsSubscribable {
  subscriptions = {};

  connetions = {};

  isPaused: boolean = false;

  messagesWhilePaused: { cb: (data: any) => any, data: any }[] = [];

  public async subscribe(url: string, channel: string, handler: (data: any) => any) {
    const parsedUrl: URL = new URL(url);
    const subId = `${parsedUrl.origin}-${channel}`;

    if (!parsedUrl.searchParams.has('tabId')) {
      parsedUrl.searchParams.append('tabId', getTabId());
    }

    await this.ensureConnection(parsedUrl.origin);
    await fetch(parsedUrl.toString());

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
        this.connetions[url.origin] = await getEventSourceAsync(url);
      } catch (ex) {
        this.connetions[url.origin] = await getEventSourceAsync(url);
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
