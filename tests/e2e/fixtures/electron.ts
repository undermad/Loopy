import { _electron as electron, test as base, type ElectronApplication, type Page } from '@playwright/test';

interface ElectronFixtures {
  app: ElectronApplication;
  window: Page;
}

export const test = base.extend<ElectronFixtures>({
  app: async ({}, use) => {
    const app = await electron.launch({ args: ['.'] });
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
