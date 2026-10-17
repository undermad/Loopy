import { describe, expect, it } from 'vitest';
import type { BoardNode } from '@shared/board';
import {
  absolutePosition,
  bringToFront,
  containerAt,
  createEdge,
  createItem,
  descendants,
  duplicateItems,
  edgeData,
  effectiveZ,
  fitSize,
  itemAt,
  itemData,
  normaliseRect,
  parentsFirst,
  presetSize,
  reparent,
  resolveItemStyle,
  sendToBack,
  sidesBetween,
  withStyle,
} from '@renderer/lib/board';

function node(id: string, x: number, y: number, extra: Partial<BoardNode> = {}): BoardNode {
  return {
    id,
    boardId: 'b',
    parentId: null,
    type: 'text',
    x,
    y,
    width: 100,
    height: 80,
    z: 1,
    data: {},
    ...extra,
  };
}

describe('board items', () => {
  it('creates items from presets with sizes, styles and extra data', () => {
    const sticky = createItem({ boardId: 'b', preset: 'sticky', rect: { x: 5, y: 6 }, z: 3 });
    expect(sticky).toMatchObject({ type: 'text', x: 5, y: 6, width: 200, height: 120, z: 3, parentId: null });
    expect(sticky.data['style']).toMatchObject({ fill: { hex: '#fde68a' }, shadow: true });
    const frame = createItem({
      boardId: 'b',
      preset: 'container',
      rect: { x: 0, y: 0, width: 50, height: 0 },
      z: 1,
    });
    expect(frame).toMatchObject({ type: 'container', width: 50, height: 1, data: { title: '' } });
    const card = createItem({
      boardId: 'b',
      preset: 'card',
      rect: { x: 0, y: 0 },
      z: 1,
      data: { templateId: 't' },
    });
    expect(card.data).toMatchObject({ templateId: 't' });
    expect(presetSize('diamond')).toEqual({ width: 160, height: 120 });
    expect(
      createItem({ boardId: 'b', preset: 'ellipse', rect: { x: 0, y: 0 }, z: 1 }).data['style'],
    ).toMatchObject({
      shape: 'ellipse',
      align: 'center',
    });
  });

  it('resolves styles from type defaults and layers, and parses item and edge data safely', () => {
    expect(resolveItemStyle('text')).toMatchObject({
      shape: 'rectangle',
      fill: null,
      padding: 8,
      fontSize: 14,
    });
    expect(resolveItemStyle('card')).toMatchObject({ shadow: true, radius: 10 });
    const layered = resolveItemStyle('card', { radius: 2, shadow: false }, { radius: 20, fill: null });
    expect(layered).toMatchObject({ radius: 20, shadow: false, fill: null });
    expect(itemData(node('a', 0, 0, { data: { text: 'hi', locked: 'nope' } }))).toMatchObject({
      text: '',
      locked: false,
    });
    expect(itemData({ type: 'image', data: { assetId: 'x' } })).toMatchObject({
      assetId: 'x',
      fit: 'contain',
    });
    expect(edgeData({ data: {} })).toMatchObject({ endMarker: 'arrowClosed', width: 2, path: 'bezier' });
    expect(edgeData({ data: { width: 99 } }).width).toBe(2);
    expect(createEdge('b', 'a', 'c', { label: 'go' })).toMatchObject({
      sourceId: 'a',
      targetId: 'c',
      data: { label: 'go' },
    });
    expect(
      withStyle(node('a', 0, 0, { data: { style: { radius: 2 } } }), { shadow: true }).data['style'],
    ).toEqual({
      radius: 2,
      shadow: true,
    });
  });

  it('nests items in containers with relative coordinates', () => {
    const outer = node('outer', 100, 100, { type: 'container', width: 400, height: 300 });
    const inner = node('inner', 20, 20, {
      type: 'container',
      parentId: 'outer',
      width: 200,
      height: 150,
      z: 2,
    });
    const leaf = node('leaf', 10, 10, { parentId: 'inner', z: 3 });
    const loose = node('loose', 900, 900);
    const nodes = [leaf, inner, outer, loose];

    expect(absolutePosition(leaf, nodes)).toEqual({ x: 130, y: 130 });
    expect(descendants('outer', nodes)).toEqual(['inner', 'leaf']);
    expect(parentsFirst(nodes).map((item) => item.id)).toEqual(['outer', 'inner', 'leaf', 'loose']);
    expect(containerAt({ x: 150, y: 150 }, nodes)?.id).toBe('inner');
    expect(containerAt({ x: 450, y: 350 }, nodes)?.id).toBe('outer');
    expect(containerAt({ x: 150, y: 150 }, nodes, ['outer'])).toBeNull();
    expect(containerAt({ x: 5, y: 5 }, nodes)).toBeNull();

    expect(reparent(loose, 'inner', nodes)).toMatchObject({ parentId: 'inner', x: 780, y: 780 });
    expect(reparent(leaf, null, nodes)).toMatchObject({ parentId: null, x: 130, y: 130 });
    expect(reparent(leaf, 'inner', nodes)).toBe(leaf);
    expect(effectiveZ(leaf, nodes)).toBeGreaterThan(effectiveZ(inner, nodes));
    expect(itemAt({ x: 135, y: 135 }, nodes)?.id).toBe('leaf');
    expect(itemAt({ x: 135, y: 135 }, nodes, ['leaf'])?.id).toBe('inner');
    expect(itemAt({ x: -5, y: -5 }, nodes)).toBeNull();
  });

  it('duplicates items with their children and the arrows between them', () => {
    const frame = node('frame', 0, 0, { type: 'container' });
    const child = node('child', 5, 5, { parentId: 'frame', data: { text: 'a' } });
    const outside = node('outside', 300, 0);
    const edges = [createEdge('b', 'child', 'frame'), createEdge('b', 'child', 'outside')];
    const copy = duplicateItems(['frame', 'child'], [frame, child, outside], edges);
    expect(copy.nodes).toHaveLength(2);
    expect(copy.ids).toHaveLength(1);
    const [frameCopy, childCopy] = copy.nodes;
    expect(frameCopy).toMatchObject({ type: 'container', x: 24, y: 24, parentId: null });
    expect(childCopy).toMatchObject({ parentId: frameCopy?.id, x: 5, y: 5, data: { text: 'a' } });
    expect(childCopy?.data).not.toBe(child.data);
    expect(copy.edges).toHaveLength(1);
    expect(copy.edges[0]).toMatchObject({ sourceId: childCopy?.id, targetId: frameCopy?.id });

    const single = duplicateItems(['child'], [frame, child], []);
    expect(single.nodes[0]).toMatchObject({ parentId: 'frame', x: 29, y: 29 });
  });

  it('reorders z, works out connection sides, image sizes and drag rectangles', () => {
    const nodes = [node('a', 0, 0, { z: 1 }), node('b', 0, 0, { z: 5 }), node('c', 0, 0, { z: 3 })];
    expect(bringToFront(['a', 'c'], nodes).map((item) => [item.id, item.z])).toEqual([
      ['a', 6],
      ['c', 7],
    ]);
    expect(sendToBack(['b'], nodes).map((item) => item.z)).toEqual([-1]);
    const left = { x: 0, y: 0, width: 100, height: 100 };
    expect(sidesBetween(left, { x: 300, y: 10, width: 50, height: 50 })).toEqual({
      source: 'right',
      target: 'left',
    });
    expect(sidesBetween(left, { x: -300, y: 0, width: 50, height: 50 })).toEqual({
      source: 'left',
      target: 'right',
    });
    expect(sidesBetween(left, { x: 0, y: 400, width: 50, height: 50 })).toEqual({
      source: 'bottom',
      target: 'top',
    });
    expect(sidesBetween(left, { x: 0, y: -400, width: 50, height: 50 })).toEqual({
      source: 'top',
      target: 'bottom',
    });
    expect(fitSize(1600, 800)).toEqual({ width: 320, height: 160 });
    expect(fitSize(100, 50)).toEqual({ width: 100, height: 50 });
    expect(fitSize(0, 0)).toEqual({ width: 320, height: 240 });
    expect(normaliseRect({ x: 10, y: 50 }, { x: 0, y: 20 })).toEqual({ x: 0, y: 20, width: 10, height: 30 });
  });
});
