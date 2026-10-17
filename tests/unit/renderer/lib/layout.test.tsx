import { describe, expect, it } from 'vitest';
import type { LayoutNode, SplitNode } from '@shared/layout';
import {
  collectAreas,
  createArea,
  findParent,
  joinAreas,
  neighbours,
  normalise,
  patchAreaState,
  removeArea,
  resizeSplit,
  setAreaEditor,
  splitArea,
  swapAreas,
} from '@renderer/lib/layout';

const a = createArea('tickets');
const b = createArea('ticket');
const row: SplitNode = { kind: 'split', id: 'row', direction: 'row', children: [a, b], sizes: [0.7, 0.3] };

function sum(node: LayoutNode): number {
  return node.kind === 'split' ? node.sizes.reduce((total, size) => total + size, 0) : 1;
}

describe('splitArea', () => {
  it('replaces an area with a split and uses the drag ratio', () => {
    const { root, newAreaId } = splitArea(a, a.id, 'column', 0.25);
    expect(root.kind).toBe('split');
    const split = root as SplitNode;
    expect(split.direction).toBe('column');
    expect(split.children.map((child) => child.id)).toEqual([a.id, newAreaId]);
    expect(split.sizes).toEqual([0.25, 0.75]);
    expect(collectAreas(root)[1]?.editor).toBe('tickets');
  });

  it('inserts into the parent when the direction matches instead of nesting', () => {
    const { root, newAreaId } = splitArea(row, a.id, 'row');
    const split = root as SplitNode;
    expect(split.children).toHaveLength(3);
    expect(split.children[1]?.id).toBe(newAreaId);
    expect(split.sizes.map((size) => Number(size.toFixed(2)))).toEqual([0.35, 0.35, 0.3]);
    expect(sum(root)).toBeCloseTo(1);
  });

  it('places the new area first when asked', () => {
    const { root, newAreaId } = splitArea(a, a.id, 'row', 0.75, 'assets', true);
    const split = root as SplitNode;
    expect(split.children.map((child) => child.id)).toEqual([newAreaId, a.id]);
    expect(split.sizes).toEqual([0.25, 0.75]);
    const inserted = splitArea(row, b.id, 'row', 0.5, 'assets', true);
    const parent = inserted.root as SplitNode;
    expect(parent.children.map((child) => child.id)).toEqual([a.id, inserted.newAreaId, b.id]);
    expect(parent.sizes.map((size) => Number(size.toFixed(2)))).toEqual([0.7, 0.15, 0.15]);
  });

  it('clamps the ratio and ignores unknown areas', () => {
    expect((splitArea(a, a.id, 'row', 0.01).root as SplitNode).sizes[0]).toBe(0.1);
    expect(splitArea(row, 'missing', 'row').root).toBe(row);
  });
});

describe('removeArea and joinAreas', () => {
  it('collapses a two-child split and hands the size to the neighbour', () => {
    expect(removeArea(row, b.id)).toEqual(a);
    const three = splitArea(row, a.id, 'row').root as SplitNode;
    const middle = three.children[1];
    expect(middle).toBeDefined();
    const after = removeArea(three, middle?.id ?? '', a.id) as SplitNode;
    expect(after.children.map((child) => child.id)).toEqual([a.id, b.id]);
    expect(after.sizes[0]).toBeCloseTo(0.7);
  });

  it('only joins adjacent sibling areas', () => {
    expect(joinAreas(row, a.id, b.id)).toEqual(a);
    const nested = splitArea(row, b.id, 'column').root;
    const innerSplit = (nested as SplitNode).children[1] as SplitNode;
    const deep = innerSplit.children[0];
    expect(deep).toBeDefined();
    expect(joinAreas(nested, a.id, deep?.id ?? '')).toBe(nested);
  });

  it('reports neighbours by side', () => {
    expect(neighbours(row, a.id)).toEqual({ right: b });
    expect(neighbours(row, b.id)).toEqual({ left: a });
    const column = splitArea(a, a.id, 'column').root;
    expect(Object.keys(neighbours(column, a.id))).toEqual(['bottom']);
  });
});

describe('normalise', () => {
  it('flattens same-direction nesting and single-child splits', () => {
    const inner: SplitNode = {
      kind: 'split',
      id: 'inner',
      direction: 'row',
      children: [a, b],
      sizes: [0.5, 0.5],
    };
    const c = createArea('board');
    const outer: SplitNode = {
      kind: 'split',
      id: 'outer',
      direction: 'row',
      children: [inner, c],
      sizes: [0.5, 0.5],
    };
    const flat = normalise(outer) as SplitNode;
    expect(flat.children.map((child) => child.id)).toEqual([a.id, b.id, c.id]);
    expect(flat.sizes).toEqual([0.25, 0.25, 0.5]);
    const single: SplitNode = { kind: 'split', id: 's', direction: 'column', children: [a], sizes: [1] };
    expect(normalise(single)).toEqual(a);
  });
});

describe('swap, resize, editor and state', () => {
  it('swaps editors in place, resizes a split and patches area state', () => {
    const swapped = swapAreas(row, a.id, b.id) as SplitNode;
    expect(swapped.children.map((child) => (child as typeof a).editor)).toEqual(['ticket', 'tickets']);
    expect(swapped.children.map((child) => child.id)).toEqual([a.id, b.id]);

    const resized = resizeSplit(row, 'row', [1, 3]) as SplitNode;
    expect(resized.sizes).toEqual([0.25, 0.75]);

    const retyped = setAreaEditor(row, a.id, 'board', { zoom: 2 });
    expect(collectAreas(retyped)[0]).toMatchObject({ editor: 'board', state: { zoom: 2 } });

    const patched = patchAreaState(retyped, a.id, { grid: true });
    expect(collectAreas(patched)[0]?.state).toEqual({ zoom: 2, grid: true });
    expect(findParent(row, a.id)?.index).toBe(0);
  });
});
