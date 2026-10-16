import { expect, test } from './fixtures/electron';

test('launches with the Loopy window and reports its version', async ({ app, window }) => {
  await expect(window).toHaveTitle('Loopy');
  await expect(window.getByRole('heading', { level: 1 })).toHaveText('Loopy');

  const badge = window.getByRole('button', { name: /Loopy v\d+\.\d+\.\d+/ });
  await expect(badge).toBeVisible();

  await badge.hover();
  const electronVersion = await app.evaluate(() => process.versions.electron);
  await expect(window.getByRole('tooltip')).toHaveText(`Electron ${electronVersion}`);
});

test('runs with context isolation and without Node access in the renderer', async ({ window }) => {
  const nodeExposed = await window.evaluate(() => typeof (globalThis as { require?: unknown }).require);
  expect(nodeExposed).toBe('undefined');
});
