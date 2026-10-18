import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WelcomeScreen } from '@renderer/components/Welcome/WelcomeScreen';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeRecent, type FakeApi } from './helpers/api';

let api: FakeApi;

function Harness() {
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <WelcomeScreen />
      </ToastProvider>
    </TooltipProvider>
  );
}

beforeEach(async () => {
  api = await bootTestApp();
});

describe('welcome flows', () => {
  it('opens a file from the chosen location and reports a failed open', async () => {
    const user = userEvent.setup();
    vi.mocked(api.openProject)
      .mockResolvedValueOnce({ status: 'cancelled' })
      .mockResolvedValueOnce({ status: 'failed', code: 'NOT_A_PROJECT' });
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Open file…' }));
    expect(api.openProject).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('The project could not be opened.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open file…' }));
    expect(await screen.findByText('The project could not be opened.')).toBeInTheDocument();
  });

  it('reports a recent file that fails to open', async () => {
    const user = userEvent.setup();
    const quest = makeRecent('Quest');
    api.recent = [quest];
    api.emitProject();
    vi.mocked(api.openRecentProject).mockResolvedValueOnce({ status: 'failed', code: 'CORRUPT' });
    render(<Harness />);

    await user.click(await screen.findByRole('button', { name: /Quest/ }));

    expect(await screen.findByText('The project could not be opened.')).toBeInTheDocument();
  });

  it('reports a project that could not be created', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createProject).mockRejectedValueOnce(new Error('disk full'));
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'New project' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'New project' })).toBeInTheDocument();
  });
});
