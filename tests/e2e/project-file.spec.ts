import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import {
  CANCEL,
  DISCARD,
  answerSavePrompt,
  chooseSaveLocation,
  closeApp,
  crash,
  savePrompts,
} from './fixtures/electron';

let userData: string;
const running: ElectronApplication[] = [];

test.beforeEach(async () => {
  userData = await mkdtemp(join(tmpdir(), 'loopy-e2e-file-'));
});

test.afterEach(async () => {
  await Promise.all(running.splice(0).map((app) => closeApp(app)));
  await rm(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

async function launch(): Promise<{ app: ElectronApplication; window: Page }> {
  const app = await electron.launch({ args: ['.'], env: { ...process.env, LOOPY_USER_DATA: userData } });
  running.push(app);
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return { app, window };
}

async function createUntitled(window: Page): Promise<void> {
  await window.getByRole('button', { name: 'New project' }).click();
  await expect(window.getByLabel(/Project name/)).toHaveValue('Untitled');
  await window.getByRole('button', { name: 'Create' }).click();
  await expect(window.getByRole('region', { name: 'To do' })).toBeVisible();
}

async function pressCloseButton(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.close();
  });
}

function exited(app: ElectronApplication): Promise<void> {
  return new Promise((resolve) => {
    if (app.process().exitCode !== null) resolve();
    else
      app.process().once('exit', () => {
        resolve();
      });
  });
}

test('asks before quitting with a project that was never saved and stays open on Cancel', async () => {
  const { app, window } = await launch();
  await createUntitled(window);
  await answerSavePrompt(app, CANCEL);

  await pressCloseButton(app);
  await expect.poll(() => savePrompts(app)).toEqual(['Save changes to "Untitled" before closing?']);
  await expect(window.getByRole('region', { name: 'To do' })).toBeVisible();

  await answerSavePrompt(app, CANCEL);
  await window.getByRole('menuitem', { name: 'File' }).click();
  await window.getByRole('menuitem', { name: 'Quit' }).click();
  await expect.poll(() => savePrompts(app)).toHaveLength(1);
  await expect(window.getByRole('region', { name: 'To do' })).toBeVisible();

  await answerSavePrompt(app, DISCARD);
  const done = exited(app);
  await pressCloseButton(app);
  await done;
});

test('quits a saved project without asking and asks again once it changes', async () => {
  const { app, window } = await launch();
  await createUntitled(window);
  const file = join(userData, 'Games', 'Untitled.loopy');
  await chooseSaveLocation(app, file);
  await window.keyboard.press('Control+S');
  await expect
    .poll(() =>
      access(file).then(
        () => true,
        () => false,
      ),
    )
    .toBe(true);
  await expect(window).toHaveTitle('Untitled — Loopy');

  await window.getByRole('menuitem', { name: 'File' }).click();
  await window.getByRole('menuitem', { name: 'Project settings…' }).click();
  await window
    .getByRole('dialog', { name: 'Project settings' })
    .getByLabel(/Project name/)
    .fill('Renamed');
  await window
    .getByRole('dialog', { name: 'Project settings' })
    .getByRole('button', { name: 'Save' })
    .click();
  await expect(window).toHaveTitle('• Renamed — Loopy');
  await expect(window.getByText('Unsaved changes')).toBeVisible();

  await window.keyboard.press('Control+S');
  await expect(window).toHaveTitle('Renamed — Loopy');
  await answerSavePrompt(app, CANCEL);
  const done = exited(app);
  await window.getByRole('menuitem', { name: 'File' }).click();
  await window.getByRole('menuitem', { name: 'Quit' }).click();
  await done;
});

test('offers to recover unsaved work after a crash', async () => {
  const first = await launch();
  await createUntitled(first.window);
  await first.window.getByRole('menuitem', { name: 'File' }).click();
  await first.window.getByRole('menuitem', { name: 'Project settings…' }).click();
  const settings = first.window.getByRole('dialog', { name: 'Project settings' });
  await settings.getByLabel(/Project name/).fill('Crashed Game');
  await settings.getByRole('button', { name: 'Save' }).click();
  await expect(first.window).toHaveTitle('• Crashed Game — Loopy');

  const done = exited(first.app);
  crash(first.app);
  await done;
  running.splice(running.indexOf(first.app), 1);

  const { window } = await launch();
  const panel = window.getByRole('region', { name: 'Recover unsaved work' });
  await expect(panel.getByText('Crashed Game')).toBeVisible();
  await panel.getByRole('button', { name: 'Restore Crashed Game' }).click();

  await expect(window.getByRole('region', { name: 'To do' })).toBeVisible();
  await expect(window).toHaveTitle('• Crashed Game — Loopy');
});
