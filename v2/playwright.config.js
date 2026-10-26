import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:5175', headless: true, launchOptions: { executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' } },
  reporter: 'list',
  webServer: process.env.P0AS_TEST_SERVER_MANAGED === '1' ? undefined : { command: 'node scripts/dev.mjs --browser-tests', url: 'http://127.0.0.1:5175', reuseExistingServer: false, timeout: 30000 },
});
