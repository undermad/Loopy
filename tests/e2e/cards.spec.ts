import { expect, test } from './fixtures/electron';

test('designs a template, saves a card from it and finds the card in Assets', async ({ window }) => {
  await window.getByRole('button', { name: 'New project' }).click();
  await window.getByLabel(/Project name/).fill('Space Game');
  await window.getByRole('button', { name: 'Create' }).click();

  await window.getByRole('tab', { name: 'Cards' }).click();
  await window.getByRole('button', { name: 'Quest' }).click();
  await window.getByRole('button', { name: 'Save template' }).click();
  await expect(window.getByRole('list', { name: 'Templates' }).getByText('Quest')).toBeVisible();

  await window.getByRole('button', { name: 'New card from this template' }).click();
  const name = window.getByRole('textbox', { name: 'Card name' });
  await name.fill('Find the key');
  await window.getByRole('button', { name: 'Save card' }).click();
  await expect(window.getByRole('list', { name: 'Cards' }).getByText('Find the key')).toBeVisible();

  await window.getByRole('tab', { name: 'Assets' }).click();
  const cards = window.getByRole('tree', { name: 'Cards' });
  await cards.getByRole('treeitem', { name: /Cards/ }).click();
  await expect(window.getByRole('button', { name: 'Find the key' })).toBeVisible();
});
