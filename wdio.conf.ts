/* eslint-disable import/prefer-default-export */
// import type { Options } from '@wdio/types';
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer();

exports.config = {
  specs: [
    './specs.wdio/browser_sdk/**/*.spec.ts',
  ],

  exclude: [

  ],

  maxInstances: 1,

  capabilities: [{
    maxInstances: 1,

    browserName: 'chrome',
    'goog:chromeOptions': {
      w3c: false,
      args: ['headless', 'disable-gpu', 'window-size=1920,1080'],
    },
  }],

  logLevel: 'warn',

  bail: 1,

  baseUrl: 'http://localhost:3002',

  services: [
    ['static-server', {
      port: 3002,
      folders: [
        { mount: '/', path: './specs.wdio/testapp' },
      ],
      middleware: [
        {
          mount: '/',
          middleware: (req, res, next) => {
            if (req.url.startsWith('/login') || req.url.startsWith('/callback')) {
              proxy.web(req, res, { target: 'http://localhost:3000' });
            } else {
              next();
            }
          },
        },
      ],
    }],
  ],

  waitforTimeout: 100000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  framework: 'mocha',

  mochaOpts: {
    timeout: 100000,
  },
  reporters: [
    [
      'spec', {
        realtimeReporting: true,
        addConsoleLogs: true,
      },
    ],
  ],
};
