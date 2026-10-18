import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/electron';

async function openBoard(window: Page, name: string) {
  await window.getByRole('button', { name: 'New project' }).click();
  await window.getByLabel(/Project name/).fill(name);
  await window.getByRole('button', { name: 'Create' }).click();
  await window.getByRole('tab', { name: 'Design' }).click();
  await window.getByRole('button', { name: 'New board' }).first().click();
  await window.getByRole('button', { name: 'Create' }).click();
  const pane = window.locator('.react-flow__pane');
  await expect(pane).toBeVisible();
  const box = await pane.boundingBox();
  if (!box) throw new Error('missing pane');
  return box;
}

async function stroke(window: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await window.mouse.move(from.x, from.y);
  await window.mouse.down();
  await window.mouse.move(to.x, to.y, { steps: 24 });
  await window.mouse.up();
}

const COUNT_INK = `(() => {
  let total = 0;
  for (const canvas of document.querySelectorAll('[data-testid="drawing-layer"] canvas')) {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) total += 1;
  }
  return total;
})()`;

function inkCoverage(window: Page): Promise<number> {
  return window.evaluate<number>(COUNT_INK);
}

async function settledCoverage(window: Page): Promise<number> {
  let previous = -1;
  for (;;) {
    await window.waitForTimeout(150);
    const current = await inkCoverage(window);
    if (current === previous) return current;
    previous = current;
  }
}

test('draws on a new layer, erases, undoes and redoes', async ({ window }) => {
  const box = await openBoard(window, 'Sketchbook');
  const layers = window.getByTestId('drawing-layer');

  await window.getByRole('button', { name: 'Brush (B)' }).click();
  await expect(window.getByRole('toolbar', { name: 'Brush options' })).toBeVisible();
  const left = { x: box.x + box.width * 0.3, y: box.y + box.height * 0.5 };
  const right = { x: box.x + box.width * 0.7, y: box.y + box.height * 0.5 };
  await stroke(window, left, right);

  await expect(layers).toHaveCount(1);
  await expect.poll(async () => Number(await layers.getAttribute('data-tiles'))).toBeGreaterThan(0);
  await expect.poll(() => inkCoverage(window)).toBeGreaterThan(100);
  const painted = await settledCoverage(window);

  await stroke(window, { x: left.x, y: left.y + 40 }, { x: right.x, y: right.y + 40 });
  await expect(layers).toHaveCount(1);
  await expect.poll(() => inkCoverage(window)).toBeGreaterThan(painted);
  const twice = await settledCoverage(window);

  await window.keyboard.press('e');
  await stroke(window, left, right);
  await expect.poll(() => inkCoverage(window)).toBeLessThan(twice);

  await window.keyboard.press('Control+z');
  await expect.poll(() => inkCoverage(window)).toBe(twice);
  await window.keyboard.press('Control+z');
  await window.keyboard.press('Control+z');
  await expect(layers).toHaveCount(0);

  await window.keyboard.press('Control+Shift+z');
  await expect(layers).toHaveCount(1);
  await expect.poll(() => inkCoverage(window)).toBe(painted);
});

test('keeps drawings after reopening the project', async ({ window }) => {
  const box = await openBoard(window, 'Persistent');
  await window.getByRole('button', { name: 'Brush (B)' }).click();
  await stroke(
    window,
    { x: box.x + box.width * 0.4, y: box.y + box.height * 0.4 },
    { x: box.x + box.width * 0.6, y: box.y + box.height * 0.6 },
  );
  await expect.poll(() => inkCoverage(window)).toBeGreaterThan(50);
  const painted = await settledCoverage(window);
  const node = window.locator('.react-flow__node-drawing');
  await expect.poll(async () => (await node.boundingBox())?.width ?? 0).toBeGreaterThan(20);

  await window.reload();
  await window.getByRole('tab', { name: 'Design' }).click();
  await expect(window.getByTestId('drawing-layer')).toHaveCount(1);
  await expect.poll(() => inkCoverage(window)).toBe(painted);
});

test('selects a drawing by its paint, drags it and keeps clicks on empty areas free', async ({ window }) => {
  const box = await openBoard(window, 'Arranging');
  await window.getByRole('button', { name: 'Brush (B)' }).click();
  const from = { x: box.x + box.width * 0.3, y: box.y + box.height * 0.5 };
  const to = { x: box.x + box.width * 0.6, y: box.y + box.height * 0.5 };
  await stroke(window, from, to);
  const node = window.locator('.react-flow__node-drawing');
  await expect.poll(async () => (await node.boundingBox())?.width ?? 0).toBeGreaterThan(20);
  const before = await node.boundingBox();
  if (!before) throw new Error('missing drawing');

  await window.keyboard.press('v');
  await window.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.8);
  await expect(node).not.toHaveClass(/selected/);

  const grab = { x: box.x + box.width * 0.45, y: box.y + box.height * 0.5 };
  await window.mouse.move(grab.x, grab.y);
  await window.mouse.move(grab.x + 1, grab.y);
  await window.mouse.down();
  await window.mouse.move(grab.x + 40, grab.y + 60, { steps: 10 });
  await window.mouse.up();
  await expect.poll(async () => (await node.boundingBox())?.y ?? 0).toBeGreaterThan(before.y + 40);
  await expect(node).toHaveClass(/selected/);
  await expect(window.getByRole('heading', { name: 'Drawing' })).toBeVisible();
});

test('changes brush size with the bracket keys', async ({ window }) => {
  const box = await openBoard(window, 'Shortcuts');
  await window.getByRole('button', { name: 'Brush (B)' }).click();
  const options = window.getByRole('toolbar', { name: 'Brush options' });
  const size = options.getByRole('spinbutton', { name: 'Size' });
  await expect(size).toHaveValue('4');
  await window.mouse.move(box.x + 200, box.y + 300);
  await window.keyboard.press(']');
  await window.keyboard.press(']');
  await expect(size).not.toHaveValue('4');
  await window.keyboard.press('[');
  await window.keyboard.press('[');
  await expect(size).toHaveValue('4');
});

test('shows a far zoomed out drawing from reduced tiles', async ({ window }) => {
  const box = await openBoard(window, 'Overview');
  await window.getByRole('button', { name: 'Brush (B)' }).click();
  const size = window
    .getByRole('toolbar', { name: 'Brush options' })
    .getByRole('spinbutton', { name: 'Size' });
  await size.fill('40');
  await size.press('Enter');
  await stroke(
    window,
    { x: box.x + box.width * 0.2, y: box.y + box.height * 0.3 },
    { x: box.x + box.width * 0.8, y: box.y + box.height * 0.7 },
  );
  const node = window.locator('.react-flow__node-drawing');
  await expect.poll(async () => (await node.boundingBox())?.width ?? 0).toBeGreaterThan(100);
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await window.mouse.move(centre.x, centre.y);
  for (let step = 0; step < 6; step += 1) await window.mouse.wheel(0, 400);
  await expect.poll(async () => (await node.boundingBox())?.width ?? 1000).toBeLessThan(60);
  await expect.poll(() => inkCoverage(window)).toBeGreaterThan(0);
});
