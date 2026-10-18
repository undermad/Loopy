import { spawn } from 'node:child_process';
import { copyFile, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import electronPath from 'electron';

let root: string;
const running: ElectronApplication[] = [];

test.beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'loopy-e2e-open-'));
});

test.afterEach(async () => {
  await Promise.all(running.splice(0).map((app) => app.close()));
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

async function launch(userData: string, args: string[] = []): Promise<Page> {
  const app = await electron.launch({
    args: ['.', ...args],
    env: { ...process.env, LOOPY_USER_DATA: userData },
  });
  running.push(app);
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return window;
}

async function exportedProject(name: string): Promise<string> {
  const source = join(root, 'source');
  const window = await launch(source);
  await window.getByRole('button', { name: 'New project' }).click();
  await window.getByLabel(/Project name/).fill(name);
  await window.getByRole('button', { name: 'Create' }).click();
  await expect(window.getByRole('region', { name: 'To do' })).toBeVisible();
  await running.pop()?.close();

  const projects = join(source, 'projects');
  const file = (await readdir(projects)).find((entry) => entry.endsWith('.loopy'));
  if (!file) throw new Error('the project file was not written');
  const external = join(root, `${name}.loopy`);
  await copyFile(join(projects, file), external);
  return external;
}

test('opens a project file passed on the command line, as Explorer does', async () => {
  const external = await exportedProject('Explorer Game');

  const window = await launch(join(root, 'fresh'), [external]);

  await expect(window.getByRole('region', { name: 'To do' })).toBeVisible();
  await expect(window.getByText('Explorer Game').first()).toBeVisible();
});

test('hands a file opened while Loopy runs to the running window', async () => {
  const external = await exportedProject('Second Launch');
  const userData = join(root, 'running');
  const window = await launch(userData);
  await expect(window.getByRole('heading', { level: 1 })).toHaveText('Welcome to Loopy');

  const second = spawn(electronPath as unknown as string, ['.', external], {
    env: { ...process.env, LOOPY_USER_DATA: userData },
    stdio: 'ignore',
  });
  const exitCode = await new Promise<number | null>((resolve) => second.once('exit', resolve));

  expect(exitCode).toBe(0);
  await expect(window.getByRole('region', { name: 'To do' })).toBeVisible();
  await expect(window.getByText('Second Launch').first()).toBeVisible();
});
