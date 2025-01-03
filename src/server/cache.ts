const cache: Map<any, any> = new Map();

export default {
  get: (key: string) => cache.get(key),
  set: (key: string, value: any) => cache.set(key, value),
  invalidate: (key: string) => {
    cache.delete(key);
  },
};
