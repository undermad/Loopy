import { describe, expect, it } from 'vitest';
import { ticketKey } from '@shared/tickets';
import { buildWorkspace } from '@shared/layout-presets';
import { describeKeys } from '@renderer/lib/shortcuts';
import {
  collectAreas,
  createArea,
  normalise,
  removeArea,
  resizeSplit,
  swapAreas,
} from '@renderer/lib/layout';

describe('small helpers', () => {
  it('describes keys per platform', () => {
    expect(describeKeys('$mod+N', 'Win32')).toBe('Ctrl + N');
    expect(describeKeys('$mod+Comma', 'MacIntel')).toBe('⌘ + ,');
  });

  it('builds ticket keys with a fallback prefix', () => {
    expect(ticketKey('Space Game', 7)).toBe('SPA-7');
    expect(ticketKey('', 1)).toBe('LPY-1');
    expect(ticketKey('!!', 2)).toBe('LPY-2');
  });

  it('falls back to the empty template for unknown ids', () => {
    const workspace = buildWorkspace('nope' as 'empty', 'X');
    expect(collectAreas(workspace.root).map((area) => area.editor)).toEqual(['empty']);
  });

  it('handles tree edge cases without changing the tree', () => {
    const area = createArea('empty');
    expect(removeArea(area, area.id)).toBe(area);
    expect(swapAreas(area, area.id, area.id)).toBe(area);
    expect(resizeSplit(area, 'missing', [1])).toBe(area);
    const split = {
      kind: 'split' as const,
      id: 's',
      direction: 'row' as const,
      children: [area, createArea('b')],
      sizes: [0, 0],
    };
    const flat = normalise(split);
    expect(flat.kind === 'split' ? flat.sizes : null).toEqual([0.5, 0.5]);
    expect(resizeSplit(split, 's', [1, 1, 1])).toEqual(split);
  });
});
