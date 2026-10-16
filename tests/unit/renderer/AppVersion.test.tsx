import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppVersion } from '@renderer/components/AppVersion/AppVersion';

const getAppVersion = vi.fn();

beforeEach(() => {
  getAppVersion.mockReset();
  window.loopy = { getAppVersion };
});

describe('AppVersion', () => {
  it('shows a loading state until the version arrives', () => {
    getAppVersion.mockReturnValue(new Promise(() => undefined));
    render(<AppVersion />);

    expect(screen.getByText('Loading version…')).toBeInTheDocument();
  });

  it('shows the app version and reveals the Electron version in a tooltip', async () => {
    getAppVersion.mockResolvedValue({ app: '0.1.0', electron: '44.8.0' });
    const user = userEvent.setup();
    render(<AppVersion />);

    const badge = await screen.findByRole('button', { name: 'Loopy v0.1.0' });
    expect(badge).toHaveTextContent('v0.1.0');

    await user.hover(badge);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Electron 44.8.0');
  });
});
