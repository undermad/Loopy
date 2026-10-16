import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { AxeResults } from 'axe-core';
import { expect, test } from './fixtures/electron';

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

test('main window has no serious or critical accessibility violations', async ({ window }) => {
  await window.getByRole('button', { name: /Loopy v/ }).waitFor();

  await window.evaluate(axeSource);
  const results = await window.evaluate(() =>
    (globalThis as unknown as { axe: { run: () => Promise<AxeResults> } }).axe.run(),
  );
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});
