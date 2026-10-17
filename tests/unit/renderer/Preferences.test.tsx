import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesDialog } from '@renderer/components/Preferences/PreferencesDialog';
import { bootTestApp, type FakeApi } from './helpers/api';

let api: FakeApi;

beforeEach(async () => {
  api = await bootTestApp();
});

describe('PreferencesDialog', () => {
  it('changes the dark theme, the font size and the language', async () => {
    const user = userEvent.setup();
    render(<PreferencesDialog open onOpenChange={vi.fn()} />);

    const fontSize = screen.getByLabelText('Font size');
    await user.clear(fontSize);
    await user.type(fontSize, '18');
    expect(api.setSettings).toHaveBeenLastCalledWith({ fontSize: 18 });

    await user.click(screen.getByRole('tab', { name: 'Language' }));
    await user.click(screen.getByRole('combobox', { name: 'Language' }));
    await user.click(await screen.findByRole('option', { name: 'English' }));
    expect(api.setSettings).toHaveBeenLastCalledWith({ language: 'en' });
  });
});
