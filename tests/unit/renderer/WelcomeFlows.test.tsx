import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WelcomeScreen } from '@renderer/components/Welcome/WelcomeScreen';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

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
  it('reports import results and failed opens', async () => {
    const user = userEvent.setup();
    const imported = makeProject('Imported');
    vi.mocked(api.importProject)
      .mockResolvedValueOnce({ status: 'imported', project: imported })
      .mockResolvedValueOnce({ status: 'failed', code: 'NOT_A_PROJECT' });
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Open file…' }));
    expect(await screen.findByText('Project "Imported" imported.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open file…' }));
    expect(await screen.findByText('The project could not be opened.')).toBeInTheDocument();
  });

  it('deletes a project from its context menu and reports a failed open', async () => {
    const user = userEvent.setup();
    const project = makeProject('Old');
    api.projects = [project];
    api = await bootTestApp();
    api.projects = [project];
    api.emitProject();
    vi.mocked(api.openProject).mockResolvedValueOnce({ status: 'failed', code: 'CORRUPT' });
    render(<Harness />);

    const row = await screen.findByRole('button', { name: /Old/ });
    await user.click(row);
    expect(await screen.findByText('The project could not be opened.')).toBeInTheDocument();

    const { fireEvent } = await import('@testing-library/react');
    fireEvent.contextMenu(row.closest('li') as HTMLElement);
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(api.deleteProject).toHaveBeenCalledWith(project.id);
  });
});
