import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppVersion } from '@renderer/components/AppVersion/AppVersion';
import { TooltipProvider } from '@renderer/ui';
import { bootTestApp, type FakeApi } from './helpers/api';

let api: FakeApi;

beforeEach(async () => {
  api = await bootTestApp();
});

describe('AppVersion', () => {
  it('shows a loading state until the version arrives', () => {
    vi.mocked(api.getAppVersion).mockReturnValue(new Promise(() => undefined));
    render(<AppVersion />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows the app version and reveals the Electron version in a tooltip', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <AppVersion />
      </TooltipProvider>,
    );

    const badge = await screen.findByRole('button', { name: 'Loopy v0.1.0' });
    expect(badge).toHaveTextContent('v0.1.0');

    await user.hover(badge);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Electron 44.8.0');
  });
});
