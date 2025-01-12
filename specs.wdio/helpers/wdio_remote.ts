/* eslint-disable no-eval */

export default class WdioRemote {
  browser: WebdriverIO.Browser;

  constructor(browser: WebdriverIO.Browser) {
    this.browser = browser;
  }

  replaceProxyInstance(oriObj) {
    let obj = oriObj;

    if (obj === null) {
      return undefined;
    }

    if (!obj || typeof obj === 'string' || typeof obj === 'number') {
      return obj;
    }

    if (Array.isArray(obj)) {
      obj.forEach((element, index) => {
        obj[index] = this.replaceProxyInstance(element);
      });
    } else if (typeof obj === 'object' && !obj['proxy-instance']) {
      Object.keys(obj).forEach((key) => {
        obj[key] = this.replaceProxyInstance(obj[key]);
      });
    } else if (obj['proxy-instance']) {
      const self = this;
      const proxyInstanceId = obj['proxy-instance'];
      const objId = obj.id;

      obj = new Proxy({}, {
        get(target, prop) {
          if (prop === 'then') {
            return Reflect.get(target, prop);
          }

          if (prop === 'id') {
            return objId;
          }

          if (prop === 'proxy-instance') {
            return proxyInstanceId;
          }

          return new Proxy(() => {}, {
            apply: (t, thisArg, argumentsList) => self.execute(async (remoteId, method, args) => {
              const robj = (window as any).remoteInstances[remoteId];

              if (!robj[method]) {
                throw new Error(`executing remote method via wdio did not work as method ${method} is undefined on ${robj.create}.`);
              }

              return robj[method](...args);
            }, proxyInstanceId, prop, argumentsList),
          });
        },

        set(target, prop, value) {
          throw new Error(`WDIO_REMOTE: setting a value is not implemented on a remote object ${String(prop)}, ${value}`);
        },
      });
    }

    return obj;
  }

  async execute(script, ...rest): Promise<any> {
    const resultObject = await this.browser.executeAsync(async (...args) => {
      const fnStr = args.shift();
      const done = args.pop();
      const fn = eval(fnStr);
      const result = await fn(...args);

      function replaceNonJSONObject(oriObj) {
        let obj = oriObj;

        if (!obj || typeof obj === 'string' || typeof obj === 'number') {
          return obj;
        }

        if (Array.isArray(obj)) {
          obj.forEach((element, index) => {
            obj[index] = replaceNonJSONObject(element);
          });
        } else if (obj.constructor === {}.constructor) {
          Object.keys(obj).forEach((key) => {
            obj[key] = replaceNonJSONObject(obj[key]);
          });
        } else {
          const remoteId = `proxy-${Date.now()}-${Math.random().toString(36)}`;
          (window as any).remoteInstances = (window as any).remoteInstances || {};
          (window as any).remoteInstances[remoteId] = obj;
          obj = {
            'proxy-instance': remoteId,
            id: obj.id,
          };
        }

        return obj;
      }

      done(replaceNonJSONObject(result));
    }, `${script}`, ...rest);

    return this.replaceProxyInstance(resultObject);
  }
}
