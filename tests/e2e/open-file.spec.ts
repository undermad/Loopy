import { spawn } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import electronPath from 'electron';
import { chooseSaveLocation, closeApp } from './fixtures/electron';

let root: string;
const running: ElectronApplication[] = [];

test.beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'loopy-e2e-open-'));
});

test.afterEach(async () => {
  await Promise.all(running.splice(0).map((app) => closeApp(app)));
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

async function launch(
  userData: string,
  args: string[] = [],
): Promise<{ app: ElectronApplication; window: Page }> {
  const app = await electron.launch({
    args: ['.', ...args],
    env: { ...process.env, LOOPY_USER_DATA: userData },
  });
  running.push(app);
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return { app, window };
}

async function savedProject(name: string): Promise<string> {
  const { app, window } = await launch(join(root, 'source'));
  await window.getByRole('button', { name: 'New project' }).click();
  await window.getByLabel(/Project name/).fill(name);
  await window.getByRole('button', { name: 'Create' }).click();
  await expect(window.getByRole('region', { name: 'To do' })).toBeVisible();

  const file = join(root, 'chosen folder', `${name}.loopy`);
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
  running.splice(running.indexOf(app), 1);
  await closeApp(app);
  return file;
}

test('opens a project file passed on the command line, as Explorer does', async () => {
  const file = await savedProject('Explorer Game');

  const { window } = await launch(join(root, 'fresh'), [file]);

  await expect(window.getByRole('region', { name: 'To do' })).toBeVisible();
  await expect(window).toHaveTitle('Explorer Game — Loopy');
});

test('hands a file opened while Loopy runs to the running window', async () => {
  const file = await savedProject('Second Launch');
  const userData = join(root, 'running');
  const { window } = await launch(userData);
  await expect(window.getByRole('heading', { level: 1 })).toHaveText('Welcome to Loopy');

  const second = spawn(electronPath as unknown as string, ['.', file], {
    env: { ...process.env, LOOPY_USER_DATA: userData },
    stdio: 'ignore',
  });
  const exitCode = await new Promise<number | null>((resolve) => second.once('exit', resolve));

  expect(exitCode).toBe(0);
  await expect(window.getByRole('region', { name: 'To do' })).toBeVisible();
  await expect(window).toHaveTitle('Second Launch — Loopy');
});

test('lists a saved file under Recent by its location and opens it from there', async () => {
  const file = await savedProject('Recent Game');
  const { window } = await launch(join(root, 'source'));

  const recent = window.getByRole('region', { name: 'Recent' });
  await expect(recent.getByText(file)).toBeVisible();
  await recent.getByRole('button', { name: /Recent Game/ }).click();

  await expect(window.getByRole('region', { name: 'To do' })).toBeVisible();
});
