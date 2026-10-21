import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LAYOUT_SCHEMA_VERSION, type LayoutPreset } from '@shared/layout';
import { buildWorkspace } from '@shared/layout-presets';
import { App } from '@renderer/App';
import { useAreaContext } from '@renderer/components/Shell/AreaContext';
import { useBoardSnapshot } from '@renderer/lib/board';
import { collectAreas } from '@renderer/lib/layout';
import { areaActions, useActiveWorkspace } from '@renderer/lib/workspaces';
import { bootTestApp, makeProject } from './helpers/api';

describe('remaining branches', () => {
  it('throws outside an area, returns null for no board, and falls back to the empty editor', async () => {
    const api = await bootTestApp();
    expect(() => renderHook(() => useAreaContext())).toThrow(/inside an Area/);
    const { result } = renderHook(() => useBoardSnapshot(null));
    expect(result.current).toBeNull();

    const project = makeProject('Space Game');
    api.current = project;
    api.emitProject();
    render(<App />);
    await screen.findByRole('tab', { name: 'Planning' });
    const workspace = renderHook(() => useActiveWorkspace()).result.current;
    const firstArea = collectAreas(
      workspace?.root ?? { kind: 'area', id: 'x', editor: 'empty', state: {} },
    )[0];
    act(() => {
      areaActions.setEditor(firstArea?.id ?? '', 'bogus');
    });
    expect(await screen.findByText('Empty area')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: ' ', code: 'Space', ctrlKey: true });
    expect(screen.getAllByRole('tab')).toHaveLength(7);
  });

  it('reports an imported layout from the Window menu', async () => {
    const api = await bootTestApp();
    const project = makeProject('Space Game');
    api.current = project;
    api.emitProject();
    const layout: LayoutPreset = {
      schemaVersion: LAYOUT_SCHEMA_VERSION,
      id: 'fresh',
      name: 'Fresh',
      workspaces: [buildWorkspace('empty', 'E')],
    };
    vi.mocked(api.importLayout).mockResolvedValueOnce({ status: 'imported', layout });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('tab', { name: 'Planning' });

    await user.click(screen.getByRole('menuitem', { name: 'Window' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Import layout…' }));
    expect(await screen.findByText('Layout "Fresh" imported.')).toBeInTheDocument();
  });
});
