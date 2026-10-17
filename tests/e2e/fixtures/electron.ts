import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, test as base, type ElectronApplication, type Page } from '@playwright/test';

interface ElectronFixtures {
  userData: string;
  app: ElectronApplication;
  window: Page;
}

export const test = base.extend<ElectronFixtures>({
  userData: async ({}, use) => {
    const directory = await mkdtemp(join(tmpdir(), 'loopy-e2e-'));
    await use(directory);
    await rm(directory, { recursive: true, force: true });
  },
  app: async ({ userData }, use) => {
    const app = await electron.launch({ args: ['.'], env: { ...process.env, LOOPY_USER_DATA: userData } });
    await use(app);
    await app.close();
  },
  window: async ({ app }, use) => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await use(window);
  },
});

export { expect } from '@playwright/test';
