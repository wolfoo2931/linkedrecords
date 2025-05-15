/* eslint-disable import/prefer-default-export */
// import type { Options } from '@wdio/types';
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer();

exports.config = {
  specs: [
    './specs.wdio/**/*.spec.ts',
  ],

  suites: {
    // npm run wdio:fast -- --suite tinytodo
    tinytodo: ['./specs.wdio/tinytodo/**/*.spec.ts'],
    auth: ['./specs.wdio/**/auth.spec.ts'],
    quota_upgrade: ['./specs.wdio/quota_upgrade/**/*.spec.ts'],
    browser_sdk: ['./specs.wdio/browser_sdk/**/*.spec.ts'],
    load: ['./specs.wdio/load/**/*.spec.ts'],
  },

  exclude: [
  ],

  maxInstances: 1,

  capabilities: [{
    browserName: 'chrome',
    'goog:chromeOptions': {
      args: ['headless'], // this will not change the headless mode of the different user sessions.
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
            if (req.url.startsWith('/logout') || req.url.startsWith('/login') || req.url.startsWith('/callback')) {
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
