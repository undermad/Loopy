import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { closeProject } from '@renderer/lib/project';
import {
  createPalette,
  deletePalette,
  duplicatePalette,
  findPalette,
  resolveColour,
  resolveRef,
  updatePalette,
  useColourFromRef,
  usePalette,
  usePalettes,
  useResolvedColour,
} from '@renderer/lib/palettes';
import { bootTestApp, makeProject, type FakeApi } from '../helpers/api';

let api: FakeApi;

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.projects = [project];
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
});
