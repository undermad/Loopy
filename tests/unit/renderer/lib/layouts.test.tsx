import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LAYOUT_SCHEMA_VERSION, type LayoutPreset } from '@shared/layout';
import { buildWorkspace, cloneWorkspace, isBuiltInLayoutId } from '@shared/layout-presets';
import {
  deleteLayout,
  exportLayout,
  importLayout,
  setStatusBarVisible,
  toggleFullscreen,
  useLayoutPresets,
  useStatusBarVisible,
} from '@renderer/lib/workspaces';
import { bootTestApp } from '../helpers/api';

describe('layout presets and shell state', () => {
  it('imports, exports, deletes presets and toggles the status bar', async () => {
    const api = await bootTestApp();
    const workspace = buildWorkspace('empty', 'E');
    const preset: LayoutPreset = {
      schemaVersion: LAYOUT_SCHEMA_VERSION,
      id: 'mine',
      name: 'Mine',
      workspaces: [workspace],
    };
    vi.mocked(api.importLayout).mockResolvedValueOnce({ status: 'imported', layout: preset });
    api.layouts.push(preset);
    const { result } = renderHook(() => ({ presets: useLayoutPresets(), statusBar: useStatusBarVisible() }));

    await act(async () => {
      await importLayout();
    });
    expect(result.current.presets.map((item) => item.id)).toEqual(['mine']);

    await expect(exportLayout(preset)).resolves.toEqual({ status: 'exported' });
    await act(async () => {
      await deleteLayout('mine');
    });
    expect(result.current.presets).toEqual([]);

    await act(async () => {
      await setStatusBarVisible(false);
    });
    expect(result.current.statusBar).toBe(false);
    expect(api.setShellState).toHaveBeenCalledWith({ statusBar: false });
    await expect(toggleFullscreen()).resolves.toBe(true);
    expect(isBuiltInLayoutId('default')).toBe(true);
    const copy = cloneWorkspace({ ...workspace, maximisedAreaId: 'x' }, 'Copy');
    expect(copy.maximisedAreaId).toBeUndefined();
    expect(copy.name).toBe('Copy');
  });
});
