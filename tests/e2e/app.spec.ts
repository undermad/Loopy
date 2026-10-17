import { expect, test } from './fixtures/electron';

test('launches on the welcome screen and reports its version', async ({ app, window }) => {
  await expect(window).toHaveTitle('Loopy');
  await expect(window.getByRole('heading', { level: 1 })).toHaveText('Welcome to Loopy');

  const badge = window.getByRole('button', { name: /Loopy v\d+\.\d+\.\d+/ });
  await expect(badge).toBeVisible();

  await badge.hover();
  const electronVersion = await app.evaluate(() => process.versions.electron);
  await expect(window.getByRole('tooltip')).toHaveText(`Electron ${electronVersion}`);
});

test('creates a project, shows workspaces and adds a ticket', async ({ window }) => {
  await window.getByRole('button', { name: 'New project' }).click();
  await window.getByLabel(/Project name/).fill('Space Game');
  await window.getByRole('button', { name: 'Create' }).click();

  await expect(window.getByRole('tab', { name: 'Planning' })).toHaveAttribute('aria-selected', 'true');
  const todo = window.getByRole('region', { name: 'To do' });
  await expect(todo).toBeVisible();

  await todo.getByRole('textbox', { name: 'Add ticket' }).fill('Design the hero');
  await todo.getByRole('textbox', { name: 'Add ticket' }).press('Enter');
  await expect(todo.getByRole('button', { name: 'SPA-1 Design the hero' })).toBeVisible();

  await window.getByRole('tab', { name: 'Design' }).click();
  await expect(window.getByRole('button', { name: 'New board' }).first()).toBeVisible();
});

test('runs with context isolation and without Node access in the renderer', async ({ window }) => {
  const nodeExposed = await window.evaluate(() => typeof (globalThis as { require?: unknown }).require);
  expect(nodeExposed).toBe('undefined');
});
