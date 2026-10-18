import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assetDropZoneProps, reportAssetDrag, useAssetDropZone } from '@renderer/lib/assets';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('asset drags across areas', () => {
  it('tells the drop zone under the pointer about moves, leaving and drops', () => {
    const zone = document.createElement('div');
    zone.setAttribute(Object.keys(assetDropZoneProps)[0] ?? '', '');
    const inside = document.createElement('span');
    zone.append(inside);
    document.body.append(zone);
    const under = vi.spyOn(document, 'elementsFromPoint').mockReturnValue([inside]);
    const handler = vi.fn();
    const ref = { current: zone };
    renderHook(() => {
      useAssetDropZone(ref, handler);
    });

    expect(reportAssetDrag(['a'], 10, 20, 'move')).toBe(true);
    expect(handler).toHaveBeenLastCalledWith({ ids: ['a'], links: [], x: 10, y: 20, phase: 'move' });
    under.mockReturnValue([]);
    expect(reportAssetDrag(['a'], 400, 20, 'move')).toBe(false);
    expect(handler).toHaveBeenLastCalledWith({ ids: ['a'], links: [], x: 400, y: 20, phase: 'leave' });
    under.mockReturnValue([inside]);
    expect(reportAssetDrag(['a'], 12, 22, 'drop')).toBe(true);
    expect(handler).toHaveBeenLastCalledWith({ ids: ['a'], links: [], x: 12, y: 22, phase: 'drop' });
    reportAssetDrag(['a'], 12, 22, 'move');
    expect(reportAssetDrag([], Number.NaN, Number.NaN, 'cancel')).toBe(false);
    expect(handler).toHaveBeenLastCalledWith({
      ids: [],
      links: [],
      x: Number.NaN,
      y: Number.NaN,
      phase: 'leave',
    });

    const other = document.createElement('div');
    other.setAttribute(Object.keys(assetDropZoneProps)[0] ?? '', '');
    document.body.append(other);
    under.mockReturnValue([other]);
    const calls = handler.mock.calls.length;
    reportAssetDrag(['a'], 1, 1, 'drop');
    expect(handler.mock.calls).toHaveLength(calls);
  });
});
