import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createItemStyle, deleteItemStyle, updateItemStyle, useItemStyles } from '@renderer/lib/itemStyles';
import { closeProject } from '@renderer/lib/project';
import { bootTestApp, makeProject, type FakeApi } from '../helpers/api';

let api: FakeApi;

beforeEach(async () => {
  api = await bootTestApp();
  api.current = makeProject('Space Game');
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

describe('item style presets store', () => {
  it('loads, creates, renames and deletes presets for the open project', async () => {
    const { result } = renderHook(() => useItemStyles());
    expect(result.current).toEqual([]);

    const warning = await act(() =>
      createItemStyle({ name: 'Warning', style: { fill: { hex: '#fde68a', ref: null }, italic: true } }),
    );
    expect(result.current?.map((preset) => preset.name)).toEqual(['Warning']);

    await act(() => updateItemStyle(warning.id, { name: 'Alert' }));
    expect(result.current?.[0]).toMatchObject({ name: 'Alert', style: { italic: true } });

    await act(() => deleteItemStyle(warning.id));
    expect(result.current).toEqual([]);

    await act(async () => {
      await closeProject();
    });
    expect(result.current).toBeNull();
  });
});
