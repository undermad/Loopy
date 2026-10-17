import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@renderer/App';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.projects = [project];
  api.recent = [{ id: project.id, name: project.name, openedAt: '2026-10-17T08:00:00.000Z' }];
  api.current = project;
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
    expect(screen.getAllByRole('tab')).toHaveLength(4);

    vi.mocked(api.importLayout).mockResolvedValueOnce({ status: 'invalid' });
    await user.click(screen.getByRole('menuitem', { name: 'Window' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Import layout…' }));
    expect(await screen.findByText('That file is not a Loopy layout.')).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Window' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Export layout…' }));
    expect(api.exportLayout).toHaveBeenCalled();
  });

  it('opens recent projects, exports and closes the project, and shows about', async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<App />);
    await screen.findByRole('tab', { name: 'Planning' });

    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.hover(await screen.findByRole('menuitem', { name: 'Open recent' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Space Game' }));
    await waitFor(() => {
      expect(api.openProject).toHaveBeenCalled();
    });

    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Export project…' }));
    expect(api.exportProject).toHaveBeenCalled();

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
    expect(await screen.findByRole('dialog', { name: 'New project' })).toBeInTheDocument();
  });
});
