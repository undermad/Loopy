import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import { chooseSaveLocation, expect, test } from './fixtures/electron';

async function newProject(window: Page): Promise<void> {
  await window.getByRole('button', { name: 'New project' }).click();
  await window.getByLabel(/Project name/).fill('Space Game');
  await window.getByRole('button', { name: 'Create' }).click();
  await window.getByRole('tab', { name: 'Data tables' }).click();
}

function cell(window: Page, row: number, column: number) {
  return window.getByRole('grid').locator(`[data-row="${String(row)}"][data-column="${String(column)}"]`);
}

async function chooseOpenFile(app: ElectronApplication, filePath: string): Promise<void> {
  await app.evaluate(({ dialog }, target) => {
    dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [target] });
  }, filePath);
}

test('builds a table with typed columns and a formula, undoes an edit and finds it in Assets', async ({
  window,
}) => {
  await newProject(window);
  await window.getByRole('button', { name: 'New table' }).click();
  const name = window.getByRole('textbox', { name: 'Table name' });
  await expect(name).toHaveValue('Untitled table');
  await name.fill('Weapons');
  await name.press('Enter');

  await window.getByRole('button', { name: 'Add column' }).click();
  await window.getByRole('menuitem', { name: 'Number' }).click();
  const settings = window.getByRole('complementary', { name: 'Column settings' });
  await settings.getByRole('textbox', { name: 'Label' }).fill('Damage');
  await settings.getByRole('textbox', { name: 'Label' }).press('Enter');
  await window.getByRole('button', { name: 'Add column' }).click();
  await window.getByRole('menuitem', { name: 'Formula' }).click();
  await settings.getByRole('textbox', { name: 'Formula', exact: true }).fill('number * 2');
  await settings.getByRole('textbox', { name: 'Formula', exact: true }).press('Enter');

  await window.getByRole('button', { name: 'Add row' }).click();
  await window.getByRole('button', { name: 'Add row' }).click();
  await expect(window.getByRole('row')).toHaveCount(3);

  await cell(window, 0, 0).click();
  await window.keyboard.press('F2');
  await window.keyboard.press('Control+A');
  await window.keyboard.type('sword');
  await window.keyboard.press('Enter');
  await cell(window, 0, 1).click();
  await window.keyboard.type('Iron sword');
  await window.keyboard.press('Tab');
  await window.keyboard.type('4');
  await window.keyboard.press('Enter');
  await expect(cell(window, 0, 0)).toHaveText('sword');
  await expect(cell(window, 0, 2)).toHaveText('4');
  await expect(cell(window, 0, 3)).toHaveText('8');

  await cell(window, 0, 2).click();
  await window.keyboard.type('10');
  await window.keyboard.press('Enter');
  await expect(cell(window, 0, 3)).toHaveText('20');
  await window.getByRole('grid').press('Control+z');
  await expect(cell(window, 0, 2)).toHaveText('4');

  await expect(window.getByRole('list', { name: 'Data tables' }).getByText('Weapons')).toBeVisible();
  await window.getByRole('tab', { name: 'Assets' }).click();
  const tables = window.getByRole('tree', { name: 'Data tables' });
  await tables.getByRole('treeitem', { name: /Data tables/ }).click();
  await expect(window.getByRole('button', { name: 'Weapons' })).toBeVisible();
});

test('pastes rows from a spreadsheet, exports CSV and imports it back', async ({ app, window, userData }) => {
  await newProject(window);
  await window.getByRole('button', { name: 'New table' }).click();
  await expect(window.getByRole('grid')).toBeVisible();

  await window.getByRole('button', { name: 'Add row' }).click();
  await cell(window, 0, 0).click();
  await app.evaluate(({ clipboard }) => clipboard.writeText('bat\tBat\nbig_bat\tBig bat\n'));
  await window.getByRole('grid').press('Control+v');
  await expect(window.getByRole('row')).toHaveCount(3);
  await expect(cell(window, 1, 1)).toHaveText('Big bat');

  const target = join(userData, 'Bats.csv');
  await chooseSaveLocation(app, target);
  await window.getByRole('button', { name: 'Export' }).click();
  await window.getByRole('menuitem', { name: 'CSV' }).click();
  await expect(window.getByText('Untitled table exported')).toBeVisible();
  await expect.poll(() => readFile(target, 'utf8')).toBe('id,name\r\nbat,Bat\r\nbig_bat,Big bat');

  const source = join(userData, 'Enemies.csv');
  await writeFile(source, 'id,hp,boss\ngoblin,3,no\ndragon,90,yes\n', 'utf8');
  await chooseOpenFile(app, source);
  await window.getByRole('button', { name: 'Import' }).click();
  await expect(window.getByRole('textbox', { name: 'Table name' })).toHaveValue('Enemies');
  await expect(window.getByRole('columnheader')).toHaveText(['id', 'hp', 'boss']);
  await expect(cell(window, 1, 1)).toHaveText('90');
  await expect(cell(window, 1, 2).getByRole('checkbox')).toBeChecked();
});
