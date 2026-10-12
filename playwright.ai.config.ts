import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'ai-browser.spec.ts',
  workers: 1,
  timeout: 90_000,
  outputDir: '.cache/playwright-ai',
  reporter: 'list',
  webServer: [
    {
      command: 'node server/dist/server/src/index.js',
      url: 'http://127.0.0.1:3002/health',
      reuseExistingServer: false,
      env: { AI_MODE: 'mock', GEMINI_API_KEY: '', NODE_ENV: 'development', HOST: '127.0.0.1', PORT: '3002', ALLOWED_ORIGINS: 'http://127.0.0.1:8444', MOCK_TEST_SCENARIOS: 'true' },
    },
    {
      command: 'node node_modules/vite/bin/vite.js preview --outDir .cache/gemini-build-verification --host 127.0.0.1 --port 8444',
      url: 'http://127.0.0.1:8444',
      reuseExistingServer: false,
      env: { PORT: '8444', AI_PROXY_TARGET: 'http://127.0.0.1:3002' },
    },
  ],
  use: {
    baseURL: 'http://127.0.0.1:8444',
    browserName: 'chromium',
    channel: process.env.AI_TEST_BROWSER_CHANNEL || 'chrome',
    headless: true,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
