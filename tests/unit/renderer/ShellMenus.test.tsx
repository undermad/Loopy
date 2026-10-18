import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@renderer/App';
import { bootTestApp, makeProject, makeRecent, type FakeApi } from './helpers/api';

let api: FakeApi;

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.recent = [{ ...makeRecent('Space Game'), id: project.id }];
  api.current = project;
  api.path = api.recent[0]?.path ?? null;
  api.emitProject();
});

describe('shell menus', () => {
  it('runs edit commands, toggles fullscreen and the status bar, and loads layouts', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('tab', { name: 'Planning' });

    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Copy' }));
    expect(api.editCommand).toHaveBeenCalledWith('copy');

    await user.click(screen.getByRole('menuitem', { name: 'Window' }));
    await user.click(await screen.findByRole('menuitem', { name: /Toggle fullscreen/ }));
    expect(api.toggleFullscreen).toHaveBeenCalled();

    await user.click(screen.getByRole('menuitem', { name: 'Window' }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Status bar' }));
    expect(api.setShellState).toHaveBeenCalledWith({ statusBar: false });
    expect(screen.queryByText('Project: Space Game')).not.toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Window' }));
    await user.hover(await screen.findByRole('menuitem', { name: 'Load layout' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Design' }));
    await waitFor(() => {
      expect(screen.getAllByRole('tab')).toHaveLength(1);
    });

    await user.click(screen.getByRole('menuitem', { name: 'Window' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Reset to default layout' }));
    expect(screen.getAllByRole('tab')).toHaveLength(5);

    vi.mocked(api.importLayout).mockResolvedValueOnce({ status: 'invalid' });
    await user.click(screen.getByRole('menuitem', { name: 'Window' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Import layout…' }));
    expect(await screen.findByText('That file is not a Loopy layout.')).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Window' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Export layout…' }));
    expect(api.exportLayout).toHaveBeenCalled();
  });

  it('opens recent projects, saves and closes the project, and shows about', async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<App />);
    await screen.findByRole('tab', { name: 'Planning' });

    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.hover(await screen.findByRole('menuitem', { name: 'Open recent' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Space Game' }));
    await waitFor(() => {
      expect(api.openRecentProject).toHaveBeenCalledWith(api.recent[0]?.path);
    });

    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.click(await screen.findByRole('menuitem', { name: /^Save(?! as)/ }));
    expect(api.saveProject).toHaveBeenCalled();

    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.click(await screen.findByRole('menuitem', { name: /Save as…/ }));
    expect(api.saveProjectAs).toHaveBeenCalled();
    expect(screen.queryByRole('menuitem', { name: /Export project/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Open…' }));
    expect(api.openProject).toHaveBeenCalled();

    await user.click(screen.getByRole('menuitem', { name: 'Help' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Documentation' }));
    expect(open).toHaveBeenCalled();

    await user.click(screen.getByRole('menuitem', { name: 'Help' }));
    await user.click(await screen.findByRole('menuitem', { name: 'About Loopy' }));
    expect(await screen.findByText('Version 0.1.0')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Close project' }));
    expect(await screen.findByRole('heading', { name: 'Welcome to Loopy' })).toBeInTheDocument();

    await user.keyboard('{Control>}n{/Control}');
    expect(await screen.findByRole('heading', { name: 'New project' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Quit' }));
    expect(api.quitApp).toHaveBeenCalled();
  });

  it('renames the open project from Project settings and marks it unsaved', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('tab', { name: 'Planning' });
    expect(document.title).toBe('Space Game — Loopy');

    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Project settings…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Project settings' });
    const name = within(dialog).getByLabelText(/Project name/);
    expect(name).toHaveValue('Space Game');
    await user.clear(name);
    await user.type(name, 'Moon Game');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(api.renameProject).toHaveBeenCalledWith('Moon Game');
    expect(await screen.findByText('Project: Moon Game')).toBeInTheDocument();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(document.title).toBe('• Moon Game — Loopy');
  });

  it('saves with the keyboard, even from a text field, and reports a failed save', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('tab', { name: 'Planning' });

    await user.keyboard('{Control>}s{/Control}');
    expect(api.saveProject).toHaveBeenCalledTimes(1);

    await user.keyboard('{Control>}{Shift>}s{/Shift}{/Control}');
    expect(api.saveProjectAs).toHaveBeenCalledTimes(1);

    vi.mocked(api.saveProject).mockResolvedValueOnce({ status: 'failed' });
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    await user.keyboard('{Control>}s{/Control}');
    expect(api.saveProject).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('The project could not be saved.')).toBeInTheDocument();
    input.remove();
  });
});
