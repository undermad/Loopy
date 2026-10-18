import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, test as base, type ElectronApplication, type Page } from '@playwright/test';

interface ElectronFixtures {
  userData: string;
  app: ElectronApplication;
  window: Page;
}

export const DISCARD = 1;
export const CANCEL = 2;

export async function answerSavePrompt(app: ElectronApplication, response: number): Promise<void> {
  await app.evaluate(({ dialog }, answer) => {
    const store = globalThis as { loopyPrompts?: string[] };
    store.loopyPrompts = [];
    dialog.showMessageBox = (...args: unknown[]) => {
      const options = args.at(-1) as { message?: string };
      store.loopyPrompts?.push(options.message ?? '');
      return Promise.resolve({ response: answer, checkboxChecked: false });
    };
  }, response);
}

export function savePrompts(app: ElectronApplication): Promise<string[]> {
  return app.evaluate(() => (globalThis as { loopyPrompts?: string[] }).loopyPrompts ?? []);
}

export async function chooseSaveLocation(app: ElectronApplication, filePath: string): Promise<void> {
  await app.evaluate(({ dialog }, target) => {
    dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: target });
  }, filePath);
}

function hasExited(app: ElectronApplication): boolean {
  try {
    return app.process().exitCode !== null;
  } catch {
    return true;
  }
}

export async function closeApp(app: ElectronApplication): Promise<void> {
  if (hasExited(app)) return;
  await answerSavePrompt(app, DISCARD).catch(() => undefined);
  await app.close().catch(() => undefined);
}

export function crash(app: ElectronApplication): void {
  const { pid } = app.process();
  if (pid === undefined) return;
  if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(pid), '/t', '/f']);
  else process.kill(pid, 'SIGKILL');
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
    await closeApp(app);
  },
  window: async ({ app }, use) => {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await use(window);
  },
});

export { expect } from '@playwright/test';
