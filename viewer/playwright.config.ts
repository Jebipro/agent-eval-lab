import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: `.verification/phase4-${process.env.AEL_FIXTURE_MODE === 'private' ? 'private' : 'public'}-browser-results.json` }]],
  use: {
    baseURL: 'http://127.0.0.1:4173/agent-eval-lab/',
    browserName: 'chromium',
    channel: process.env.AEL_BROWSER_CHANNEL ?? 'chromium',
    headless: true
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/agent-eval-lab/',
    reuseExistingServer: false,
    timeout: 30000
  }
});
