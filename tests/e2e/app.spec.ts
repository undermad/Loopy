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

  await card.dragTo(doing.getByRole('textbox', { name: 'Add ticket' }), {
    targetPosition: { x: 10, y: -40 },
  });
  await expect(doing.getByRole('button', { name: 'DRA-1 First' })).toBeVisible();

  await doing
    .getByRole('button', { name: 'Drag to reorder states' })
    .dragTo(todo, { targetPosition: { x: 10, y: 60 } });
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
  const note = window.getByText('Write something…');
  await expect(note).toBeVisible();
  await note.dblclick();
  await window.getByRole('textbox', { name: 'Add note' }).fill('Boss fight');
  await pane.click({ position: { x: 50, y: 50 } });
  await expect(window.getByText('Boss fight')).toBeVisible();
});
