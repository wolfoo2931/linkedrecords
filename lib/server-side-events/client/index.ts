export interface IsSubscribable {
  subscribe(url: string, channel: string, handler: (data: any) => any);
  unsubscribeAll();
}

interface IsSubscription {
  eventSource: EventSource;
  channels: any;
}
interface IsSubscriberList {
  [key: string]: IsSubscription;
}

export default class ServerSideEvents implements IsSubscribable {
  subscriptions: IsSubscriberList = {};

  isPaused: boolean = false;

  messagesWhilePaused: { cb: (data: any) => any, data: any }[] = [];

  public subscribe(url: string, channel: string, handler: (data: any) => any) {
    const parsedUrl: URL = new URL(url);
    const hostWithPath: string = parsedUrl.origin + parsedUrl.pathname;
    let subscription: IsSubscription | undefined;

    if (!this.subscriptions[hostWithPath]) {
      this.subscriptions[hostWithPath] = {
        eventSource: new EventSource(url),
        channels: {},
      };

      if (!this.subscriptions[hostWithPath]) {
        return;
      }

      subscription = this.subscriptions[hostWithPath];

      if (!subscription) {
        return;
      }

      subscription.eventSource.onerror = () => {
        // TODO: implement
      };

      subscription.eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const { sseChannel } = data;

        if (!sseChannel || !subscription) {
          return;
        }

        delete data.sseChannel;

        if (subscription.channels[sseChannel]) {
          subscription.channels[sseChannel].forEach((cb) => {
            if (this.isPaused) {
              this.messagesWhilePaused.push({ cb, data });
            } else {
              cb(data);
            }
          });
        }
      };
    }

    if (!subscription) {
      return;
    }

    if (!subscription.channels[channel]) {
      subscription.channels[channel] = [];
    }

    subscription.channels[channel].push(handler);
  }

  public unsubscribeAll() {
    Object.values(this.subscriptions).forEach((sub: any) => {
      sub.eventSource.close();
      this.subscriptions = {};
    });
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
}
