import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { WelcomeScreen } from '@renderer/components/Welcome/WelcomeScreen';
import { useCurrentProject } from '@renderer/lib/project';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeRecent, type FakeApi } from './helpers/api';

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

describe('creating a project', () => {
  it('opens the creation view with Untitled filled in and creates the project without saving', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'New project' }));

    expect(screen.getByRole('heading', { name: 'New project' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Project name/)).toHaveValue('Untitled');
    expect(screen.getByText(/Nothing is written to disk until you save/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(api.createProject).toHaveBeenCalledWith('Untitled');
    expect(api.saveProject).not.toHaveBeenCalled();
    expect(await screen.findByTestId('current')).toHaveTextContent('Untitled');
  });

  it('uses the name the user types and needs a name to continue', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'New project' }));
    const name = screen.getByLabelText(/Project name/);

    await user.clear(name);
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
    await user.type(name, 'Space Game');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(api.createProject).toHaveBeenCalledWith('Space Game');
  });

  it('goes back to the welcome screen on Cancel without creating anything', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'New project' }));

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(api.createProject).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Welcome to Loopy' })).toBeInTheDocument();
  });
});

describe('recent files', () => {
  it('lists recent files by path, greys out missing ones and opens the rest', async () => {
    const quest = makeRecent('Quest');
    const gone = makeRecent('Gone');
    api.recent = [quest, gone];
    api.missing = [gone.path];
    api.emitProject();
    const user = userEvent.setup();
    render(<Harness />);

    const recent = screen.getByRole('region', { name: 'Recent' });
    expect(await within(recent).findByRole('button', { name: /Gone/ })).toBeDisabled();
    expect(within(recent).getByText(quest.path, { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Your projects' })).not.toBeInTheDocument();

    await user.click(within(recent).getByRole('button', { name: /Quest/ }));
    expect(api.openRecentProject).toHaveBeenCalledWith(quest.path);
    expect(await screen.findByTestId('current')).toHaveTextContent('Quest');
  });

  it('shows a recent file in its folder and removes it from the list', async () => {
    const quest = makeRecent('Quest');
    api.recent = [quest];
    api.emitProject();
    const user = userEvent.setup();
    render(<Harness />);
    const row = await screen.findByRole('button', { name: /Quest/ });

    fireEvent.contextMenu(row.closest('li') as HTMLElement);
    await user.click(await screen.findByRole('menuitem', { name: 'Show in folder' }));
    expect(api.revealProject).toHaveBeenCalledWith(quest.path);

    fireEvent.contextMenu(row.closest('li') as HTMLElement);
    await user.click(await screen.findByRole('menuitem', { name: 'Remove from recent' }));
    expect(api.removeRecentProject).toHaveBeenCalledWith(quest.path);
  });
});

describe('recovering unsaved work', () => {
  it('offers work from a crash and restores it', async () => {
    api.recoverable = [
      { id: crypto.randomUUID(), name: 'Lost work', path: null, modifiedAt: '2026-10-18T08:00:00.000Z' },
    ];
    api.emitProject();
    const user = userEvent.setup();
    render(<Harness />);

    const panel = await screen.findByRole('region', { name: 'Recover unsaved work' });
    expect(within(panel).getByText('Lost work')).toBeInTheDocument();
    expect(within(panel).getByText(/Not saved yet/)).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Restore Lost work' }));

    expect(api.recoverProject).toHaveBeenCalled();
    expect(await screen.findByTestId('current')).toHaveTextContent('Lost work');
  });

  it('discards recovered work', async () => {
    const id = crypto.randomUUID();
    api.recoverable = [
      { id, name: 'Lost work', path: 'D:\\Games\\Lost.loopy', modifiedAt: '2026-10-18T08:00:00.000Z' },
    ];
    api.emitProject();
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(await screen.findByRole('button', { name: 'Discard Lost work' }));

    expect(api.discardRecovery).toHaveBeenCalledWith(id);
    expect(screen.queryByRole('region', { name: 'Recover unsaved work' })).not.toBeInTheDocument();
  });
});
