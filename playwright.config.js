// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.STAGING_URL || 'https://ascen-staging-production.up.railway.app',
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  },
  projects: [
    { name: 'chromium', use: { channel: 'chromium' } },
  ],
});
