import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { WelcomeScreen } from '@renderer/components/Welcome/WelcomeScreen';
import { useCurrentProject } from '@renderer/lib/project';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function Harness() {
  const current = useCurrentProject();
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <p data-testid="current">{current?.name ?? 'none'}</p>
        <WelcomeScreen />
      </ToastProvider>
    </TooltipProvider>
  );
}

beforeEach(async () => {
  api = await bootTestApp();
});

describe('WelcomeScreen', () => {
  it('creates a project from the dialog and opens it', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByText('No projects yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New project' }));
    await user.type(screen.getByLabelText(/Project name/), 'Space Game');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(api.createProject).toHaveBeenCalledWith('Space Game');
    expect(await screen.findByTestId('current')).toHaveTextContent('Space Game');
  });

  it('lists projects and recent projects, greys out missing recent projects and removes them', async () => {
    const existing = makeProject('Existing');
    api.projects = [existing];
    api.recent = [
      { id: existing.id, name: 'Existing', openedAt: '2026-10-17T08:00:00.000Z' },
      { id: crypto.randomUUID(), name: 'Gone', openedAt: '2026-10-16T08:00:00.000Z' },
    ];
    api.emitProject();
    const user = userEvent.setup();
    render(<Harness />);

    const gone = await screen.findByRole('button', { name: /Gone/ });
    expect(gone).toBeDisabled();
    expect(await screen.findAllByRole('button', { name: /Existing/ })).toHaveLength(2);

    fireEvent.contextMenu(gone.closest('li') as HTMLElement);
    await user.click(await screen.findByRole('menuitem', { name: 'Remove from recent' }));
    expect(api.removeRecentProject).toHaveBeenCalled();

    await user.click(
      within(screen.getByRole('region', { name: 'Your projects' })).getByRole('button', { name: /Existing/ }),
    );
    expect(await screen.findByTestId('current')).toHaveTextContent('Existing');
  });
});
