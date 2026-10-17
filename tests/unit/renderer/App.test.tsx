import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@renderer/App';
import { bootTestApp, type FakeApi } from './helpers/api';

let api: FakeApi;

beforeEach(async () => {
  api = await bootTestApp();
});

describe('App', () => {
  it('renders the heading and the version badge', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Loopy');
    expect(await screen.findByRole('button', { name: 'Loopy v0.1.0' })).toBeInTheDocument();
  });

  it('opens preferences and applies a mode change to the document', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Open preferences' }));
    await user.click(await screen.findByRole('radio', { name: 'Dark' }));

    expect(api.setSettings).toHaveBeenCalledWith({ theme: { mode: 'dark', light: 'light', dark: 'dark' } });
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('follows the system scheme while in system mode', async () => {
    render(<App />);
    expect(document.documentElement.dataset['theme']).toBe('light');

    api.emitNativeTheme('dark');

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });
});
