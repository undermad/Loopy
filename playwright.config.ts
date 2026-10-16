import { defineConfig } from '@playwright/test';

const isCi = Boolean(process.env['CI']);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: isCi ? 2 : 0,
  forbidOnly: isCi,
  reporter: isCi
    ? [['list'], ['junit', { outputFile: 'test-results/playwright-junit.xml' }], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'on-failure' }]],
  outputDir: 'test-results/playwright',
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
