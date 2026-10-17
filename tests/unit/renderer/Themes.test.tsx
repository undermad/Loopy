import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesDialog } from '@renderer/components/Preferences/PreferencesDialog';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, type FakeApi } from './helpers/api';

let api: FakeApi;

function Harness() {
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <PreferencesDialog open onOpenChange={vi.fn()} />
      </ToastProvider>
    </TooltipProvider>
  );
}

beforeEach(async () => {
  api = await bootTestApp();
});

describe('Themes tab', () => {
  it('duplicates the active theme, edits a colour, exports and deletes it', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('tab', { name: 'Themes' }));
    expect(screen.getByRole('button', { name: 'Delete theme' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'New theme from current' }));
    expect(api.saveTheme).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(api.saveTheme).mock.calls[0]?.[0];
    expect(saved?.base).toBe('light');
    expect(api.settings.theme.light).toBe(saved?.id);
    expect(await screen.findByRole('button', { name: 'Delete theme' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Accent' }));
    const hex = await screen.findByRole('textbox', { name: 'Accent' });
    await user.clear(hex);
    await user.type(hex, '123456');
    expect(vi.mocked(api.saveTheme).mock.calls.at(-1)?.[0]?.colors.accent).toBe('#123456');
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#123456');
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Export theme…' }));
    expect(api.exportTheme).toHaveBeenCalledWith(saved?.id);

    await user.click(screen.getByRole('button', { name: 'Delete theme' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(api.deleteTheme).toHaveBeenCalledWith(saved?.id);
    expect(api.settings.theme.light).toBe('light');
  });

  it('imports a theme and reports an invalid file', async () => {
    const user = userEvent.setup();
    vi.mocked(api.importTheme).mockResolvedValueOnce({ status: 'invalid' });
    render(<Harness />);

    await user.click(screen.getByRole('tab', { name: 'Themes' }));
    await user.click(screen.getByRole('button', { name: 'Import theme…' }));
    expect(await screen.findByText('That file is not a Loopy theme.')).toBeInTheDocument();
  });
});
