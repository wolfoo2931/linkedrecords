import { Mutex } from 'redis-semaphore';
import Redis from 'ioredis';

export default class RedisQueuedTasks {
  redisClient: any;

  constructor() {
    if (!process.env['REDIS_HOST']) {
      throw new Error('REDIS_HOST environment variable is not set');
    }

    const redisOptions: any = {
      host: process.env['REDIS_HOST'],
      port: 6379,
    };

    if (process.env['REDIS_USERNAME']) {
      redisOptions.username = process.env['REDIS_USERNAME'];
      redisOptions.password = process.env['REDIS_PASSWORD'];
    }

    this.redisClient = new Redis(redisOptions);
  }

  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-empty-function
  async ensureReady() {
  }

  async do(queueName: string, fn: () => Promise<any>) {
    let result;
    let error;

    await this.ensureReady();
    const mutex = new Mutex(this.redisClient, queueName);

    await mutex.acquire();

    try {
      result = await fn();
    } catch (err) {
      error = err;
    }

    await mutex.release();

    if (error) {
      throw error;
    }

    return result;
  }
}
