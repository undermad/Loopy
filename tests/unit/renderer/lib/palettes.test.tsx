import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { closeProject } from '@renderer/lib/project';
import {
  createCluster,
  createPalette,
  deleteCluster,
  deletePalette,
  duplicatePalette,
  findPalette,
  moveToCluster,
  renameCluster,
  resolveColour,
  resolveRef,
  updatePalette,
  useColourFromRef,
  usePalette,
  usePaletteClusters,
  usePaletteGroups,
  usePalettes,
  useResolvedColour,
} from '@renderer/lib/palettes';
import { bootTestApp, makeProject, type FakeApi } from '../helpers/api';

let api: FakeApi;

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

describe('palettes library', () => {
  it('creates, updates, duplicates and deletes palettes and resolves references live', async () => {
    const { result } = renderHook(() => usePalettes());
    expect(result.current).toEqual([]);

    const palette = await act(() =>
      createPalette({ name: 'Sky', colours: [{ hex: '#111111' }, { hex: '#222222', name: 'Mid' }] }),
    );
    expect(result.current?.map((item) => item.name)).toEqual(['Sky']);
    expect(findPalette(palette.id)?.name).toBe('Sky');
    expect(findPalette('missing')).toBeNull();

    const colour = palette.colours[1];
    if (!colour) throw new Error('missing colour');
    const ref = { paletteId: palette.id, colourId: colour.id };
    const resolved = renderHook(() => ({
      value: useResolvedColour({ hex: '#000000', ref }),
      hex: useColourFromRef('#000000', ref),
      single: usePalette(palette.id),
    }));
    expect(resolved.result.current.value).toBe('#222222');
    expect(resolved.result.current.hex).toBe('#222222');
    expect(resolved.result.current.single?.name).toBe('Sky');

    await act(() =>
      updatePalette(palette.id, {
        colours: [{ id: colour.id, hex: '#333333', name: 'Mid' }],
        harmony: 'custom',
      }),
    );
    expect(resolved.result.current.value).toBe('#333333');
    expect(result.current?.[0]?.harmony).toBe('custom');
    expect(resolveRef(ref, result.current)).toBe('#333333');
    expect(resolveRef({ paletteId: 'x', colourId: 'y' }, result.current)).toBeNull();
    expect(resolveRef(null, result.current)).toBeNull();
    expect(resolveColour({ hex: '#abcdef', ref: { paletteId: 'x', colourId: 'y' } }, result.current)).toBe(
      '#abcdef',
    );
    expect(resolveColour(null, result.current)).toBeNull();

    const copy = await act(() => duplicatePalette(palette.id, 'Sky copy'));
    expect(copy?.name).toBe('Sky copy');
    expect(copy?.colours[0]?.hex).toBe('#333333');
    expect(await duplicatePalette('missing', 'x')).toBeNull();

    await act(() => deletePalette(palette.id));
    expect(result.current?.map((item) => item.name)).toEqual(['Sky copy']);
    expect(resolved.result.current.value).toBe('#000000');

    await act(async () => {
      await closeProject();
    });
    expect(result.current).toBeNull();
  });

  it('groups palettes under their clusters in order, with ungrouped palettes last', async () => {
    const { result } = renderHook(() => ({ groups: usePaletteGroups(), clusters: usePaletteClusters() }));
    const names = () =>
      result.current.groups.map((group) => [
        group.cluster?.name ?? null,
        group.items.map((item) => item.name),
      ]);
    const rock = await act(() => createPalette({ name: 'Rock', colours: [{ hex: '#806040' }] }));
    const fire = await act(() => createPalette({ name: 'Fire', colours: [{ hex: '#e2361b' }] }));
    expect(names()).toEqual([[null, ['Rock', 'Fire']]]);

    const library = await act(() =>
      createCluster({
        name: 'Magic',
        paletteIds: [fire.id],
        palettes: [{ name: 'Water', colours: [{ hex: '#1b6ee2' }] }],
      }),
    );
    expect(names()).toEqual([
      ['Magic', ['Fire', 'Water']],
      [null, ['Rock']],
    ]);
    const magic = library.clusters[0];
    if (!magic) throw new Error('missing cluster');
    await act(() => moveToCluster(rock.id, magic.id));
    expect(names()).toEqual([['Magic', ['Fire', 'Water', 'Rock']]]);
    await act(() => duplicatePalette(rock.id, 'Rock copy'));
    expect(names()[0]?.[1]).toEqual(['Fire', 'Water', 'Rock', 'Rock copy']);

    await act(() => renameCluster(magic.id, 'Spells'));
    expect(result.current.clusters?.map((cluster) => cluster.name)).toEqual(['Spells']);
    await act(() => createCluster({ name: 'Empty' }));
    expect(names().map(([name]) => name)).toEqual(['Spells']);
    await act(() => deleteCluster(magic.id, false));
    expect(names()).toEqual([[null, ['Rock', 'Fire', 'Water', 'Rock copy']]]);
  });
});
