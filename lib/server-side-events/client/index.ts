export default class ServerSideEvents {
  subscriptions = {};

  public subscribe(url: string, channel: string, handler) {
    const parsedUrl = new URL(url);
    const hostWithPath = parsedUrl.origin + parsedUrl.pathname;

    if (!this.subscriptions[hostWithPath]) {
      this.subscriptions[hostWithPath] = {
        eventSource: new EventSource(url),
        channels: {},
      };

      this.subscriptions[hostWithPath].eventSource.onerror = () => {
        // TODO: implement
      };

      this.subscriptions[hostWithPath].eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const { sseChannel } = data;

        if (!sseChannel) {
          return;
        }

        delete data.sseChannel;

        if (this.subscriptions[hostWithPath].channels[sseChannel]) {
          this.subscriptions[hostWithPath].channels[sseChannel].forEach((cb) => {
            cb(data);
          });
        }
      };
    }

    if (!this.subscriptions[hostWithPath].channels[channel]) {
      this.subscriptions[hostWithPath].channels[channel] = [];
    }

    this.subscriptions[hostWithPath].channels[channel].push(handler);
  }

  public unsubscribeAll() {
    Object.values(this.subscriptions).forEach((sub: any) => {
      sub.eventSource.close();
      this.subscriptions = [];
    });
  }
}
