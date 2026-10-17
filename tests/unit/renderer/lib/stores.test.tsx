import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LAYOUT_SCHEMA_VERSION } from '@shared/layout';
import { buildWorkspace } from '@shared/layout-presets';
import { createBoard, updateBoard, useBoards } from '@renderer/lib/board';
import {
  closeProject,
  deleteProject,
  importProject,
  openProject,
  revealProject,
} from '@renderer/lib/project';
import { selectTicket, ticketActions, useSelectedTicket, useTicketsLoaded } from '@renderer/lib/tickets';
import { useActiveWorkspace, useStatusBarVisible } from '@renderer/lib/workspaces';
import { bootTestApp, makeProject } from '../helpers/api';

describe('store edge cases', () => {
  it('restores saved workspaces and the status bar from shell state and falls back on a missing active id', async () => {
    const workspace = buildWorkspace('palette', 'Colours only');
    await bootTestApp({}, 'light', (fake) => {
      fake.shell = {
        workspaces: { schemaVersion: LAYOUT_SCHEMA_VERSION, items: [workspace], activeId: 'missing' },
        statusBar: false,
      };
    });
    const { result } = renderHook(() => ({ active: useActiveWorkspace(), statusBar: useStatusBarVisible() }));
    expect(result.current.active?.name).toBe('Colours only');
    expect(result.current.statusBar).toBe(false);
  });

  it('clears tickets when the project closes and reports project failures', async () => {
    const api = await bootTestApp();
    const project = makeProject('Space Game');
    api.projects = [project];
    api.current = project;
    api.emitProject();
    await act(async () => {
      await Promise.resolve();
    });
    const { result } = renderHook(() => ({ loaded: useTicketsLoaded(), selected: useSelectedTicket() }));
    await act(async () => {
      await ticketActions.create({ title: 'A' });
    });
    act(() => {
      selectTicket('ticket-1');
    });
    expect(result.current.selected?.title).toBe('A');

    await act(async () => {
      await closeProject();
    });
    expect(result.current.loaded).toBe(false);
    expect(result.current.selected).toBeNull();

    await expect(openProject(crypto.randomUUID())).resolves.toEqual({ status: 'failed', code: 'NOT_FOUND' });
    await expect(importProject()).resolves.toEqual({ status: 'cancelled' });
    await revealProject(project.id);
    expect(api.revealProject).toHaveBeenCalledWith(project.id);
    await deleteProject(project.id);
    expect(api.deleteProject).toHaveBeenCalledWith(project.id);
  });

  it('reloads the board list when a board is renamed before it was opened', async () => {
    const api = await bootTestApp();
    const project = makeProject('Space Game');
    api.projects = [project];
    api.current = project;
    api.emitProject();
    const board = await createBoard({ name: 'Ideas' });
    const { result } = renderHook(() => useBoards());
    await act(async () => {
      await updateBoard(board.id, { name: 'Renamed' });
    });
    expect(result.current?.[0]?.name).toBe('Renamed');
    expect(api.listBoards).toHaveBeenCalled();
  });
});
