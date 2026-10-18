import { expect, test } from './fixtures/electron';
import type { Locator, Page } from '@playwright/test';

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

async function dragWithMouse(window: Page, from: Locator, to: Locator, at: { x: number; y: number }) {
  const source = await from.boundingBox();
  const target = await to.boundingBox();
  if (!source || !target) throw new Error('drag endpoints are not visible');
  const startX = source.x + source.width / 2;
  const startY = source.y + source.height / 2;
  await window.mouse.move(startX, startY);
  await window.mouse.down();
  await window.mouse.move(startX + 10, startY + 10, { steps: 4 });
  await window.mouse.move(target.x + target.width * at.x, target.y + target.height * at.y, { steps: 20 });
  await window.mouse.move(target.x + target.width * at.x + 1, target.y + target.height * at.y + 1, {
    steps: 2,
  });
  await window.mouse.up();
}

test('drags a ticket between states and reorders columns', async ({ window }) => {
  await window.getByRole('button', { name: 'New project' }).click();
  await window.getByLabel(/Project name/).fill('Drag Game');
  await window.getByRole('button', { name: 'Create' }).click();
  const todo = window.getByRole('region', { name: 'To do' });
  const doing = window.getByRole('region', { name: 'In progress' });
  await todo.getByRole('textbox', { name: 'Add ticket' }).fill('First');
  await todo.getByRole('textbox', { name: 'Add ticket' }).press('Enter');
  const card = todo.getByRole('button', { name: 'DRA-1 First' });
  await expect(card).toBeVisible();

  await dragWithMouse(window, card, doing, { x: 0.5, y: 0.5 });
  await expect(doing.getByRole('button', { name: 'DRA-1 First' })).toBeVisible();

  await dragWithMouse(window, doing.getByRole('button', { name: 'Drag to reorder states' }), todo, {
    x: 0.2,
    y: 0.1,
  });
  const names = await window
    .getByRole('region')
    .filter({ has: window.getByRole('button', { name: 'Drag to reorder states' }) })
    .allInnerTexts();
  expect(names[0]).toContain('In progress');
});

test('adds a note on the board by double-clicking and edits it', async ({ window }) => {
  await window.getByRole('button', { name: 'New project' }).click();
  await window.getByLabel(/Project name/).fill('Board Game');
  await window.getByRole('button', { name: 'Create' }).click();
  await window.getByRole('tab', { name: 'Design' }).click();
  await window.getByRole('button', { name: 'New board' }).first().click();
  await window.getByRole('button', { name: 'Create' }).click();

  const pane = window.locator('.react-flow__pane');
  await expect(pane).toBeVisible();
  await pane.dblclick({ position: { x: 300, y: 200 } });
  const editor = window.getByRole('textbox', { name: 'Text' });
  await expect(editor).toBeFocused();
  await editor.fill('Boss fight');
  await pane.click({ position: { x: 50, y: 50 } });
  await expect(window.getByRole('group', { name: 'Boss fight' })).toBeVisible();
});

test('places items from the toolbar and connects them with an arrow', async ({ window }) => {
  await window.getByRole('button', { name: 'New project' }).click();
  await window.getByLabel(/Project name/).fill('Toolbox');
  await window.getByRole('button', { name: 'Create' }).click();
  await window.getByRole('tab', { name: 'Design' }).click();
  await window.getByRole('button', { name: 'New board' }).first().click();
  await window.getByRole('button', { name: 'Create' }).click();

  const pane = window.locator('.react-flow__pane');
  await expect(pane).toBeVisible();
  const box = await pane.boundingBox();
  if (!box) throw new Error('missing pane');

  for (const [x, name] of [
    [200, 'Door'],
    [600, 'Key'],
  ] as const) {
    await window.getByRole('button', { name: 'Sticky note (N)' }).click();
    await window.mouse.click(box.x + x, box.y + 250);
    await window.getByRole('textbox', { name: 'Text' }).fill(name);
    await window.mouse.click(box.x + 900, box.y + 700);
    await expect(window.getByRole('group', { name })).toBeVisible();
  }

  const door = await window.getByRole('group', { name: 'Door' }).boundingBox();
  const key = await window.getByRole('group', { name: 'Key' }).boundingBox();
  if (!door || !key) throw new Error('missing items');
  await window.getByRole('button', { name: 'Arrow (A)' }).click();
  await window.mouse.move(door.x + door.width / 2, door.y + door.height / 2);
  await window.mouse.down();
  await window.mouse.move(key.x + key.width / 2, key.y + key.height / 2, { steps: 8 });
  await window.mouse.up();
  await expect(window.locator('.react-flow__edge')).toHaveCount(1);
});

test('docks items, moves them together, undoes and adds a connected item', async ({ window }) => {
  await window.getByRole('button', { name: 'New project' }).click();
  await window.getByLabel(/Project name/).fill('Docking');
  await window.getByRole('button', { name: 'Create' }).click();
  await window.getByRole('tab', { name: 'Design' }).click();
  await window.getByRole('button', { name: 'New board' }).first().click();
  await window.getByRole('button', { name: 'Create' }).click();

  const pane = window.locator('.react-flow__pane');
  await expect(pane).toBeVisible();
  const box = await pane.boundingBox();
  if (!box) throw new Error('missing pane');
  for (const [x, name] of [
    [120, 'Door'],
    [420, 'Key'],
  ] as const) {
    await window.getByRole('button', { name: 'Sticky note (N)' }).click();
    await window.mouse.click(box.x + x, box.y + 150);
    await window.getByRole('textbox', { name: 'Text' }).fill(name);
    await window.mouse.click(box.x + 200, box.y + box.height - 40);
  }
  const door = window.getByRole('group', { name: 'Door' });
  const key = window.getByRole('group', { name: 'Key' });
  const drag = async (target: typeof door, dx: number, dy: number) => {
    const start = await target.boundingBox();
    if (!start) throw new Error('missing item');
    const x = start.x + 20;
    const y = start.y + start.height - 15;
    await window.mouse.move(x, y);
    await window.mouse.down();
    await window.mouse.move(x + 1, y);
    await window.mouse.move(x + 2, y);
    await window.mouse.move(x + dx, y + dy, { steps: 12 });
    await window.mouse.up();
  };

  const doorBox = await door.boundingBox();
  const keyBox = await key.boundingBox();
  if (!doorBox || !keyBox) throw new Error('missing items');
  await drag(key, doorBox.x + doorBox.width + 6 - keyBox.x, 0);
  await expect
    .poll(async () => Math.round(((await key.boundingBox())?.x ?? 0) - (doorBox.x + doorBox.width)))
    .toBe(0);

  await drag(door, 0, 120);
  await expect
    .poll(async () => Math.round((await key.boundingBox())?.y ?? 0))
    .toBe(Math.round(doorBox.y + 120));

  await window.keyboard.press('Control+z');
  await expect.poll(async () => Math.round((await key.boundingBox())?.y ?? 0)).toBe(Math.round(doorBox.y));

  await key.click();
  await window.getByRole('button', { name: 'Add a connected item to the right' }).click();
  await window.getByRole('option', { name: 'Same as this item' }).click();
  await window.keyboard.type('Vault');
  await window.keyboard.press('Escape');
  await expect(window.getByRole('group', { name: 'Vault' })).toBeVisible();
  await expect(window.locator('.react-flow__edge')).toHaveCount(1);
});
