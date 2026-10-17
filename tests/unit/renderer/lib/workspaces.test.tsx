import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Workspace } from '@shared/layout';
import { collectAreas } from '@renderer/lib/layout';
import {
  addWorkspace,
  applyLayout,
  areaActions,
  currentLayout,
  cycleWorkspace,
  deleteWorkspace,
  duplicateWorkspace,
  flushWorkspaces,
  moveWorkspace,
  renameWorkspace,
  saveCurrentLayout,
  setActiveWorkspace,
  useActiveWorkspace,
  useWorkspaces,
} from '@renderer/lib/workspaces';
import { bootTestApp } from '../helpers/api';

function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('Missing value');
  return value;
}

function areaIds(workspace: Workspace | null): string[] {
  return collectAreas(must(workspace).root).map((area) => area.id);
}

describe('workspaces library', () => {
  it('boots the default preset and manages the workspace list', async () => {
    const api = await bootTestApp();
    const { result } = renderHook(() => ({ all: useWorkspaces(), active: useActiveWorkspace() }));
    expect(result.current.all.map((workspace) => workspace.name)).toEqual([
      'Planning',
      'Design',
      'Palette',
      'Assets',
    ]);
    expect(result.current.active?.name).toBe('Planning');

    act(() => {
      cycleWorkspace(1);
    });
    expect(result.current.active?.name).toBe('Design');

    act(() => {
      addWorkspace('empty', 'Scratch');
    });
    expect(result.current.active?.name).toBe('Scratch');
    expect(result.current.all).toHaveLength(5);

    const scratchId = must(result.current.active).id;
    act(() => {
      renameWorkspace(scratchId, 'Notes');
      duplicateWorkspace(scratchId, 'Notes copy');
    });
    expect(result.current.all.map((workspace) => workspace.name)).toEqual([
      'Planning',
      'Design',
      'Palette',
      'Assets',
      'Notes',
      'Notes copy',
    ]);

    const copyId = must(result.current.active).id;
    act(() => {
      moveWorkspace(copyId, -3);
      deleteWorkspace(copyId);
    });
    expect(result.current.all).toHaveLength(5);
    expect(result.current.all[1]?.name).toBe('Design');

    await act(async () => {
      await flushWorkspaces();
    });
    const lastCall = vi.mocked(api.setShellState).mock.calls.at(-1)?.[0];
    expect(lastCall?.workspaces?.items).toHaveLength(5);
  });

  it('applies area actions to the active workspace', async () => {
    await bootTestApp();
    const { result } = renderHook(() => useActiveWorkspace());
    const [firstId, secondId] = areaIds(result.current);
    const first = must(firstId);
    const second = must(secondId);

    act(() => {
      areaActions.split(first, 'column', 0.3);
    });
    const ids = areaIds(result.current);
    expect(ids).toHaveLength(3);
    const added = must(ids.find((id) => id !== first && id !== second));
    let propertiesId = '';
    act(() => {
      propertiesId = areaActions.split(first, 'row', 0.75, 'properties');
    });
    expect(collectAreas(must(result.current).root).find((area) => area.id === propertiesId)).toMatchObject({
      editor: 'properties',
      state: {},
    });
    act(() => {
      areaActions.close(propertiesId);
    });
    expect(areaIds(result.current)).toHaveLength(3);

    act(() => {
      areaActions.setEditor(first, 'board', { zoom: 1 });
      areaActions.patchState(first, { grid: true });
      areaActions.toggleMaximise(first);
    });
    expect(collectAreas(must(result.current).root)[0]).toMatchObject({
      editor: 'board',
      state: { zoom: 1, grid: true },
    });
    expect(result.current?.maximisedAreaId).toBe(first);

    act(() => {
      areaActions.toggleMaximise(first);
      areaActions.join(first, added);
    });
    expect(result.current?.maximisedAreaId).toBeUndefined();
    expect(areaIds(result.current)).toEqual([first, second]);

    act(() => {
      areaActions.swap(first, second);
      areaActions.close(second);
    });
    expect(areaIds(result.current)).toEqual([first]);
    expect(collectAreas(must(result.current).root)[0]?.editor).toBe('ticket');
  });

  it('saves, applies and exports layouts', async () => {
    const api = await bootTestApp();
    const { result } = renderHook(() => useWorkspaces());

    const saved = await saveCurrentLayout('Mine');
    expect(saved.workspaces).toHaveLength(4);
    expect(api.saveLayout).toHaveBeenCalledTimes(1);

    act(() => {
      setActiveWorkspace(must(result.current[2]).id);
      deleteWorkspace(must(result.current[0]).id);
    });
    expect(result.current).toHaveLength(3);

    act(() => {
      applyLayout(saved);
    });
    expect(result.current).toHaveLength(4);
    expect(result.current[0]?.id).not.toBe(saved.workspaces[0]?.id);
    expect(currentLayout('Now').workspaces).toHaveLength(4);
  });
});
