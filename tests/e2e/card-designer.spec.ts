import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/electron';

async function openBlankTemplate(window: Page) {
  await window.getByRole('button', { name: 'New project' }).click();
  await window.getByLabel(/Project name/).fill('Space Game');
  await window.getByRole('button', { name: 'Create' }).click();
  await window.getByRole('tab', { name: 'Cards' }).click();
  await window.getByRole('button', { name: 'Blank card', exact: true }).click();
  await expect(window.getByRole('group', { name: 'Card canvas' })).toBeVisible();
}

function canvas(window: Page): Locator {
  return window.getByRole('group', { name: 'Card canvas' });
}

function field(window: Page, name: string): Locator {
  return canvas(window).getByRole('group', { name, exact: true });
}

async function fieldIds(window: Page): Promise<string[]> {
  const items = await canvas(window).locator('[data-field-id]').all();
  return Promise.all(items.map(async (item) => (await item.getAttribute('data-field-id')) ?? ''));
}

async function minHeight(window: Page, name: string): Promise<number | null> {
  const style = (await field(window, name).getAttribute('style')) ?? '';
  const match = /min-height:\s*(\d+)px/.exec(style);
  return match ? Number(match[1]) : null;
}

async function addPreset(window: Page, name: string) {
  await window.getByRole('button', { name: 'Add field', exact: true }).click();
  await window.getByRole('menuitem', { name, exact: true }).click();
}

async function drag(window: Page, from: Locator, to: { x: number; y: number }) {
  const box = await from.boundingBox();
  if (!box) throw new Error('nothing to drag');
  await window.mouse.move(box.x + 10, box.y + box.height / 2);
  await window.mouse.down();
  await window.mouse.move(box.x + 16, box.y + box.height / 2, { steps: 4 });
  await window.mouse.move(to.x, to.y, { steps: 12 });
  await window.mouse.up();
}

test('builds a card from presets and blocks on the canvas', async ({ window }) => {
  await openBlankTemplate(window);
  await addPreset(window, 'Stat bar');
  await expect(field(window, 'Stat bar').getByRole('meter')).toBeVisible();
  await addPreset(window, 'Tags');
  await window.getByRole('button', { name: 'Add field', exact: true }).click();
  await window.getByRole('menuitem', { name: 'Stat block' }).click();
  expect(await fieldIds(window)).toEqual(
    expect.arrayContaining(['title', 'description', 'stat_bar', 'tags', 'attack', 'defence', 'speed']),
  );
  await window.getByRole('button', { name: 'Edit Stat bar' }).click();
  await expect(window.getByRole('combobox', { name: 'Field type' })).toContainText('Number');
});

test('drags a field to a new place and into the footer', async ({ window }) => {
  await openBlankTemplate(window);
  await addPreset(window, 'Number');
  const title = await field(window, 'Title').boundingBox();
  if (!title) throw new Error('no title box');
  await drag(window, field(window, 'Number'), { x: title.x + 10, y: title.y + 4 });
  await expect.poll(() => fieldIds(window)).toEqual(['number', 'title', 'description']);

  const footer = canvas(window).getByRole('region', { name: 'Footer zone' });
  const target = await footer.boundingBox();
  if (!target) throw new Error('no footer box');
  await drag(window, field(window, 'Description'), {
    x: target.x + target.width / 2,
    y: target.y + target.height / 2,
  });
  await expect(footer.locator('[data-field-id="description"]')).toBeVisible();
});

test('resizes a field with its handles and undoes the change', async ({ window }) => {
  await openBlankTemplate(window);
  await field(window, 'Description').click();
  const handle = window.getByRole('slider', { name: 'Resize width of Description' });
  await expect(handle).toHaveAttribute('aria-valuenow', '12');
  const body = await canvas(window).getByRole('region', { name: 'Body zone' }).boundingBox();
  const box = await handle.boundingBox();
  if (!body || !box) throw new Error('no handle box');
  await window.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await window.mouse.down();
  await window.mouse.move(body.x + body.width / 2, box.y + box.height / 2, { steps: 10 });
  await expect(canvas(window).locator('[data-column-guides]')).toBeVisible();
  await window.mouse.up();
  await expect(handle).toHaveAttribute('aria-valuenow', '6');

  const height = window.getByRole('slider', { name: 'Resize height of Description' });
  const grip = await height.boundingBox();
  if (!grip) throw new Error('no height handle');
  await window.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await window.mouse.down();
  await window.mouse.move(grip.x + grip.width / 2, grip.y + 80, { steps: 8 });
  await window.mouse.up();
  const grown = (await minHeight(window, 'Description')) ?? 0;
  expect(grown % 4).toBe(0);
  expect(grown).toBeGreaterThan(60);

  await window.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => minHeight(window, 'Description')).toBeNull();
  await window.getByRole('button', { name: 'Undo' }).click();
  await expect(handle).toHaveAttribute('aria-valuenow', '12');
});

test('edits fields with the toolbar, keyboard and inline rename', async ({ window }) => {
  await openBlankTemplate(window);
  await field(window, 'Description').click();
  const tools = window.getByRole('toolbar', { name: 'Field tools' });
  await tools.getByRole('button', { name: 'Narrower' }).click();
  await expect(window.getByRole('slider', { name: 'Resize width of Description' })).toHaveAttribute(
    'aria-valuenow',
    '11',
  );
  await canvas(window).focus();
  await window.keyboard.press('Control+d');
  await expect(field(window, 'Description 2')).toHaveAttribute('data-selected', 'true');
  await window.keyboard.press('Enter');
  const rename = window.getByRole('textbox', { name: 'Rename Description 2' });
  await rename.fill('Lore');
  await rename.press('Enter');
  await expect(field(window, 'Lore')).toBeVisible();
  await window.keyboard.press('Alt+ArrowUp');
  expect(await fieldIds(window)).toEqual(['title', 'description_2', 'description']);
  await window.keyboard.press('Delete');
  expect(await fieldIds(window)).toEqual(['title', 'description']);
  await window.keyboard.press('Control+z');
  expect(await fieldIds(window)).toEqual(['title', 'description_2', 'description']);
});

test('fills sample values, fits the card height and saves the template', async ({ window }) => {
  await openBlankTemplate(window);
  await window.getByRole('button', { name: 'Add several' }).click();
  const dialog = window.getByRole('dialog', { name: 'Add several fields' });
  await dialog
    .getByRole('textbox', { name: 'Labels, one per line' })
    .fill(Array.from({ length: 14 }, (_, index) => `Line ${String(index + 1)}`).join('\n'));
  await dialog.getByRole('button', { name: 'Add fields' }).click();
  await expect(window.getByText('Some fields do not fit the card.')).toBeVisible();
  await window.getByRole('button', { name: 'Fit height' }).click();
  await expect(window.getByText('Some fields do not fit the card.')).toBeHidden();

  await window.getByRole('radio', { name: 'Fill in' }).click();
  await window.getByRole('button', { name: 'Fill with sample values' }).click();
  await expect(window.getByRole('textbox', { name: 'Line 1', exact: true })).not.toHaveValue('');
  await window.getByRole('radio', { name: 'Design' }).click();
  await window.getByRole('switch', { name: 'Show grid' }).click();
  await expect(canvas(window).locator('[data-grid-overlay]').first()).toBeVisible();

  await window.getByRole('button', { name: 'Save template' }).click();
  await expect(window.getByRole('list', { name: 'Templates' }).getByText('Card 1')).toBeVisible();
});
