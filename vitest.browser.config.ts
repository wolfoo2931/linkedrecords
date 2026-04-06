import { defineConfig } from 'vitest/config';
import { webdriverio } from '@vitest/browser-webdriverio';

export default defineConfig({
  test: {
    globals: true,
    browser: {
      enabled: true,
      provider: webdriverio({
        capabilities: {
          browserName: 'chrome',
          'wdio:enforceWebDriverClassic': true,
          'goog:chromeOptions': {
            args: [
              '--headless',
              '--disable-web-security',
            ],
          },
        },
      }),
      instances: [
        { browser: 'chrome' },
      ],
    },
    include: ['specs/**/*.spec.ts'],
    testTimeout: 20000,
    reporters: ['verbose'],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
});
