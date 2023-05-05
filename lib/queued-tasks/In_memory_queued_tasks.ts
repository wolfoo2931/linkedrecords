import Queue from 'queue';

export default class InMemoryQueuedTasks {
  queues: { [key: string]: Queue } = {};

  // eslint-disable-next-line @typescript-eslint/no-empty-function, class-methods-use-this
  async ensureReady() {
  }

  async do(queueName, fn) {
    if (!this.queues[queueName]) {
      this.queues[queueName] = new Queue({ concurrency: 1, autostart: true });
    }

    const queue = this.queues[queueName];

    return new Promise((resolve, reject) => {
      queue.push(async (cb) => {
        try {
          const r = await fn();
          resolve(r);
          cb();
        } catch (ex) {
          reject(ex);
        }
      });
    });
  }
}
