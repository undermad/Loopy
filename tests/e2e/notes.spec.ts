import { expect, test } from './fixtures/electron';

test('writes linked notes in the Idea Map and follows a link', async ({ window }) => {
  await window.getByRole('button', { name: 'New project' }).click();
  await window.getByLabel(/Project name/).fill('Space Game');
  await window.getByRole('button', { name: 'Create' }).click();

  await window.getByRole('tab', { name: 'Idea Map' }).click();
  const explorer = window.getByLabel('Notes', { exact: true });
  await explorer.getByRole('button', { name: 'New note' }).click();

  const title = window.getByRole('textbox', { name: 'Note title' });
  await expect(title).toHaveValue('Untitled');
  await title.fill('Combat');
  await title.press('Enter');

  const text = window.getByRole('textbox', { name: 'Note text' });
  await text.click();
  await window.keyboard.type('Uses [[Stamina]] and #core');
  await window.keyboard.press('Enter');

  const link = text.locator('.cm-wikilink', { hasText: 'Stamina' });
  await expect(link).toBeVisible();
  await link.click();
  await expect(title).toHaveValue('Stamina');

  await window.getByRole('button', { name: 'Back' }).click();
  await expect(title).toHaveValue('Combat');
  await text.click();
  await window.keyboard.press('Control+End');
  await window.keyboard.type('See [[Sta');
  await expect(window.getByRole('option', { name: /Stamina/ })).toBeVisible();
  await window.waitForTimeout(150);
  await window.keyboard.press('Enter');
  await expect(text).toContainText('See [[Stamina]]');

  await window.keyboard.press('Control+o');
  await window.getByRole('combobox', { name: 'Find or create a note' }).fill('stamina');
  await window.keyboard.press('Enter');
  await expect(title).toHaveValue('Stamina');
  await expect(window.getByRole('region', { name: 'Backlinks' }).getByText('Combat')).toBeVisible();

  await text.click();
  await window.keyboard.press('Control+End');
  await window.keyboard.type('Energy $E = mc^2$\n\n```mermaid\ngraph TD\nA --> B\n```\n');
  await window.getByRole('radio', { name: 'Reading' }).click();
  await expect(window.locator('.katex').first()).toBeVisible();
  await expect(window.getByRole('figure', { name: 'Diagram' }).locator('svg')).toBeVisible({
    timeout: 15_000,
  });
});
