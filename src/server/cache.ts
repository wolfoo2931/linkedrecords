import { createClient } from 'redis';

const cache: Map<any, any> = new Map();

const redisConnectionsPromise = {};

function getRedisConnectionPromise(connectionName) {
  if (!process.env['REDIS_HOST']) {
    return undefined;
  }

  if (redisConnectionsPromise[connectionName]) {
    return redisConnectionsPromise[connectionName];
  }

  const redisClient = createClient({
    username: process.env['REDIS_USERNAME'],
    password: process.env['REDIS_PASSWORD'],
    socket: {
      host: process.env['REDIS_HOST'],
      port: 6379,
    },
  });

  redisConnectionsPromise[connectionName] = redisClient.connect();
  return redisConnectionsPromise[connectionName];
}

getRedisConnectionPromise('sub').then((redisClient) => {
  redisClient.subscribe('invalidate_local_cache_entry', (message) => {
    cache.delete(message);
  });
});

export default {
  get: (key: string) => cache.get(key),
  set: (key: string, value: any) => cache.set(key, value),
  invalidate: (key: string) => {
    cache.delete(key);
    getRedisConnectionPromise('pub').then((redisClient) => {
      redisClient.publish('invalidate_local_cache_entry', key);
    });
  },
};
