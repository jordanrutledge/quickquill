const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 20000,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'tests/report', open: 'never' }]],
  use: {
    trace: 'on-first-retry',
    launchOptions: {
      args: ['--test-mode'],
      env: { QQ_TEST: '1' },
    },
  },
});
