import { defineConfig } from '@playwright/test';
import baseline from './playwright.config';

// Common scenarios run on every engine. The existing extension/CDP zoom test
// is a separately named Chromium project, not a silent runtime skip.
export default defineConfig({
  ...baseline,
  outputDir: 'test-results/compat',
  reporter: [['list'], ['json', { outputFile: '.verification/phase5a-browser-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:4173/agent-eval-lab/', headless: true },
  projects: [
    ...(['chromium', 'firefox', 'webkit'] as const).map(browserName => ({
      name: browserName,
      testIgnore: '**/zoom.spec.ts',
      use: { browserName, ...(browserName === 'chromium' ? { channel: 'chromium' as const } : {}) }
    })),
    { name: 'chromium-zoom', testMatch: '**/zoom.spec.ts', use: { browserName: 'chromium', channel: 'chromium' } },
    { name: 'edge', use: { browserName: 'chromium', channel: 'msedge' } }
  ]
});
