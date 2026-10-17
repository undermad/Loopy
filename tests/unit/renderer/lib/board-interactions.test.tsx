import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BoardEdge, BoardNode, BoardSnapshot } from '@shared/board';
import {
  alignItems,
  bringForward,
  childSelection,
  commitChanges,
  copyItems,
  createBoard,
  createEdge,
  distributeItems,
  dockCluster,
  dockItems,
  drillTarget,
  enteredScopes,
  findDock,
  getBoardNodes,
  historyState,
  inverseChanges,
  isReachable,
  layerPosition,
  layerRows,
  loadBoard,
  moveLayer,
  parentSelection,
  parseClip,
  pasteItems,
  quickCreate,
  recallClip,
  redoBoard,
  rememberClip,
  seams,
  sendBackward,
  serialiseClip,
  snapGuides,
  splitSeam,
  undock,
  undoBoard,
} from '@renderer/lib/board';
import { bootTestApp, makeProject } from '../helpers/api';

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

function snapshot(nodes: BoardNode[], edges: BoardEdge[] = []): BoardSnapshot {
  return { board: {} as BoardSnapshot['board'], nodes, edges };
}

const frame = node('f', 0, 0, { type: 'container', width: 400, height: 300, z: 5 });
const child = node('c', 10, 10, { parentId: 'f' });
const inner = node('inner', 200, 100, { type: 'container', parentId: 'f', width: 150, height: 150, z: 2 });
const deep = node('k', 10, 10, { parentId: 'inner' });
const nested = [frame, child, inner, deep];

describe('scoped focus', () => {
  it('only reaches top-level items until their container is selected', () => {
    const none = enteredScopes([], nested);
    expect(isReachable(frame, none)).toBe(true);
    expect(isReachable(child, none)).toBe(false);
    const inFrame = enteredScopes(['f'], nested);
    expect(isReachable(child, inFrame)).toBe(true);
    expect(isReachable(deep, inFrame)).toBe(false);
    expect([...enteredScopes(['k'], nested)].sort()).toEqual(['f', 'inner', 'k']);
  });

  it('steps out to parents, into children and drills to the item under a point', () => {
    expect(parentSelection(['k'], nested)).toEqual(['inner']);
    expect(parentSelection(['f'], nested)).toEqual([]);
    expect(childSelection(['f'], nested)).toEqual(['c', 'inner']);
    const leaf = ['c'];
    expect(childSelection(leaf, nested)).toBe(leaf);
    expect(drillTarget({ x: 20, y: 20 }, 'f', nested)?.id).toBe('c');
    expect(drillTarget({ x: 220, y: 120 }, 'f', nested)?.id).toBe('inner');
    expect(drillTarget({ x: 390, y: 290 }, 'f', nested)).toBeNull();
  });
});

describe('docking', () => {
  const a = node('a', 0, 0);

  it('snaps a nearby side flush and aligns the edges', () => {
    const snap = findDock({ x: 105, y: 4, width: 100, height: 80 }, [{ id: 'a', rect: a }], 16);
    expect(snap).toEqual({
      targetId: 'a',
      side: 'left',
      dx: -5,
      dy: -4,
      segment: { x1: 100, x2: 100, y1: 0, y2: 80 },
    });
    expect(findDock({ x: 0, y: 92, width: 100, height: 80 }, [{ id: 'a', rect: a }], 16)?.side).toBe('top');
    expect(findDock({ x: 150, y: 0, width: 100, height: 80 }, [{ id: 'a', rect: a }], 16)).toBeNull();
    expect(findDock({ x: 105, y: 70, width: 100, height: 80 }, [{ id: 'a', rect: a }], 16)).toBeNull();
  });

  it('joins clusters, detaches items and clears lone docks', () => {
    const b = node('b', 100, 0);
    const joined = dockItems(['b'], 'a', [a, b]);
    expect(joined).toHaveLength(2);
    const dock = joined[0]?.data['dock'];
    expect(typeof dock).toBe('string');
    expect(joined.every((item) => item.data['dock'] === dock)).toBe(true);
    expect(dockCluster('a', joined)).toEqual(['a', 'b']);
    expect(dockCluster('a', [a])).toEqual(['a']);
    expect(dockItems(['b'], 'missing', [a, b])).toEqual([]);

    const released = undock(['b'], joined);
    expect(released.map((item) => [item.id, item.data['dock']])).toEqual([
      ['a', null],
      ['b', null],
    ]);
    const c = node('c', 200, 0, { data: { dock } });
    expect(undock(['c'], [...joined, c]).map((item) => item.id)).toEqual(['c']);
  });

  it('finds seams and splits a cluster at one', () => {
    const docked = { data: { dock: 'd' } };
    const row = [node('a', 0, 0, docked), node('b', 100, 0, docked), node('c', 200, 0, docked)];
    const found = seams(['a', 'b', 'c'], row);
    expect(found).toEqual([
      { a: 'a', b: 'b', point: { x: 100, y: 40 } },
      { a: 'b', b: 'c', point: { x: 200, y: 40 } },
    ]);
    const first = found[0];
    if (!first) throw new Error('missing seam');
    const split = splitSeam(first, row);
    const dockOf = (id: string) => split.find((item) => item.id === id)?.data['dock'];
    expect(dockOf('a')).toBeNull();
    expect(dockOf('b')).toBe(dockOf('c'));
    expect(dockOf('b')).not.toBe('d');

    const square = [
      node('a', 0, 0, docked),
      node('b', 100, 0, docked),
      node('c', 0, 80, docked),
      node('d', 100, 80, docked),
    ];
    const loop = seams(['a', 'b', 'c', 'd'], square)[0];
    if (!loop) throw new Error('missing seam');
    expect(splitSeam(loop, square).map((item) => item.id)).toEqual(['b']);
  });
});

describe('layers', () => {
  const x = node('x', 0, 0, { z: 1 });
  const y = node('y', 0, 0, { z: 2 });
  const z = node('z', 0, 0, { z: 3 });

  it('steps items forward and backward among their siblings', () => {
    expect(bringForward(['x'], [x, y, z]).map((item) => [item.id, item.z])).toEqual([
      ['y', 1],
      ['x', 2],
    ]);
    expect(sendBackward(['z'], [x, y, z]).map((item) => [item.id, item.z])).toEqual([
      ['z', 2],
      ['y', 3],
    ]);
    expect(bringForward(['z'], [x, y, z])).toEqual([]);
    const tied = [node('a', 0, 0, { z: 1 }), node('b', 0, 0, { z: 1 })];
    expect(bringForward(['a'], tied).map((item) => [item.id, item.z])).toEqual([['a', 2]]);
  });

  it('moves a layer to an index and reports its position', () => {
    expect(moveLayer('z', 0, [x, y, z]).map((item) => [item.id, item.z])).toEqual([
      ['z', 1],
      ['x', 2],
      ['y', 3],
    ]);
    expect(moveLayer('missing', 0, [x])).toEqual([]);
    expect(layerPosition('y', [x, y, z])).toEqual({ index: 1, count: 3 });
    expect(layerPosition('missing', [x])).toEqual({ index: 0, count: 0 });
  });

  it('lists rows top first with children under their container', () => {
    const rows = layerRows([...nested, node('top', 0, 0, { z: 9 })]);
    expect(rows.map((row) => [row.node.id, row.depth, row.hasChildren])).toEqual([
      ['top', 0, false],
      ['f', 0, true],
      ['inner', 1, true],
      ['k', 2, false],
      ['c', 1, false],
    ]);
    expect(layerRows(nested, new Set(['f'])).map((row) => row.node.id)).toEqual(['f']);
  });
});

describe('arranging', () => {
  it('snaps to the nearest edge or centre and draws guides', () => {
    const result = snapGuides(
      { x: 3, y: 200, width: 100, height: 80 },
      [{ x: 0, y: 0, width: 100, height: 80 }],
      6,
    );
    expect(result.dx).toBe(-3);
    expect(result.dy).toBe(0);
    expect(result.guides).toHaveLength(3);
    expect(result.guides[0]).toEqual({ axis: 'x', position: 0, from: 0, to: 280 });
    expect(snapGuides({ x: 50, y: 50, width: 10, height: 10 }, [], 6)).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  it('aligns items in board space, nested ones included', () => {
    const a = node('a', 0, 0);
    const b = node('b', 50, 100);
    expect(alignItems(['a', 'b'], [a, b], 'left').map((item) => [item.id, item.x])).toEqual([['b', 0]]);
    expect(alignItems(['a', 'b'], [a, b], 'right').map((item) => [item.id, item.x])).toEqual([['a', 50]]);
    expect(alignItems(['a', 'b'], [a, b], 'centre').map((item) => item.x)).toEqual([25, 25]);
    expect(alignItems(['a', 'b'], [a, b], 'bottom').map((item) => [item.id, item.y])).toEqual([['a', 100]]);
    expect(alignItems(['a', 'b'], [a, b], 'middle').map((item) => item.y)).toEqual([50, 50]);
    expect(alignItems(['a'], [a], 'top')).toEqual([]);
    const box = node('box', 100, 100, { type: 'container', width: 300, height: 300 });
    const inside = node('inside', 10, 10, { parentId: 'box' });
    expect(alignItems(['a', 'inside'], [a, box, inside], 'left')).toEqual([{ ...inside, x: -100 }]);
  });

  it('spreads three or more items evenly', () => {
    const items = [node('a', 0, 0), node('b', 150, 0), node('c', 400, 0)];
    expect(distributeItems(['a', 'b', 'c'], items, 'horizontal')).toEqual([{ ...items[1], x: 200 }]);
    const column = [node('a', 0, 0), node('b', 0, 300), node('c', 0, 100)];
    expect(distributeItems(['a', 'b', 'c'], column, 'vertical')).toEqual([{ ...column[2], y: 150 }]);
    expect(distributeItems(['a', 'b'], items, 'horizontal')).toEqual([]);
  });

  it('creates a connected copy beside an item with its content cleared', () => {
    const source = node('s', 0, 0, {
      data: { text: 'Hi', name: 'Old', locked: true, dock: 'd', style: { fontSize: 20 } },
    });
    const right = quickCreate(source, 'right', [source]);
    expect(right.node).toMatchObject({ x: 148, y: 0, z: 2, data: { text: '', style: { fontSize: 20 } } });
    expect(right.node.data).not.toHaveProperty('dock');
    expect(right.edge).toMatchObject({
      sourceId: 's',
      targetId: right.node.id,
      data: { sourceHandle: 'right', targetHandle: 'left' },
    });
    expect(quickCreate(source, 'top', [source]).node.y).toBe(-128);
    const card = node('card', 0, 0, { type: 'card', data: { templateId: 't', values: { a: 1 } } });
    expect(quickCreate(card, 'bottom', [card]).node.data).toMatchObject({ templateId: 't', values: {} });
    const box = node('box', 0, 0, { type: 'container', data: { title: 'Room', showTitle: false } });
    expect(quickCreate(box, 'left', [box]).node.data).toMatchObject({ title: '', showTitle: false });
  });
});

describe('clipboard', () => {
  const parent = node('p', 100, 100, { type: 'container', width: 300, height: 300, data: { title: 'Room' } });
  const kid = node('k', 10, 10, { parentId: 'p', data: { text: 'Key', dock: 'd' } });
  const sibling = node('s', 120, 10, { parentId: 'p', data: { dock: 'd' } });
  const link = createEdge('b', 'k', 's');

  it('copies roots in board space with their children and inner arrows', () => {
    const single = copyItems(['k'], [parent, kid], []);
    expect(single.nodes).toEqual([{ ...kid, parentId: null, x: 110, y: 110 }]);
    const whole = copyItems(['p', 'k'], [parent, kid, sibling], [link]);
    expect(whole.nodes.map((item) => item.id)).toEqual(['p', 'k', 's']);
    expect(whole.edges).toEqual([link]);
  });

  it('pastes with fresh ids at a point and keeps docks together', () => {
    const clip = copyItems(['p'], [parent, kid, sibling], [link]);
    const pasted = pasteItems(clip, 'other', { x: 500, y: 400 }, [parent]);
    const [room, key, other] = pasted.nodes;
    expect(room).toMatchObject({ boardId: 'other', parentId: null, x: 500, y: 400, z: 2 });
    expect(key?.parentId).toBe(room?.id);
    expect(key?.data['dock']).toBe(other?.data['dock']);
    expect(key?.data['dock']).not.toBe('d');
    expect(pasted.edges[0]).toMatchObject({ sourceId: key?.id, targetId: other?.id, boardId: 'other' });
    expect(pasted.ids).toEqual([room?.id]);
    expect(pasteItems(clip, 'b', null, []).nodes[0]).toMatchObject({ x: 124, y: 124 });
  });

  it('serialises, parses and remembers clips', () => {
    const clip = copyItems(['p'], [parent, kid], []);
    expect(parseClip(serialiseClip(clip))).toEqual(clip);
    expect(parseClip('nope')).toBeNull();
    expect(parseClip('{}')).toBeNull();
    const text = rememberClip(clip, 'fallback');
    expect(text).toBe('Room\n\nKey');
    expect(recallClip(text)).toBe(clip);
    expect(recallClip('other')).toBeNull();
    const image = copyItems(['i'], [node('i', 0, 0, { type: 'image', data: {} })], []);
    expect(rememberClip(image, '1 board item')).toBe('1 board item');
  });
});

describe('history', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const a = node('a', 0, 0);
  const b = node('b', 100, 0);
  const edge = createEdge('b', 'a', 'b');

  it('inverts upserts, creations and cascading removals', () => {
    const made = node('n', 5, 5);
    const inverse = inverseChanges(
      { upsertNodes: [{ ...a, x: 50 }, made], removeNodeIds: ['b'], upsertEdges: [], removeEdgeIds: [] },
      snapshot([a, b], [edge]),
    );
    expect(inverse.upsertNodes).toEqual([a, b]);
    expect(inverse.removeNodeIds).toEqual(['n']);
    expect(inverse.upsertEdges).toEqual([edge]);
    const edges = inverseChanges(
      {
        upsertEdges: [{ ...edge, data: { label: 'x' } }, createEdge('b', 'b', 'a')],
        removeEdgeIds: ['gone'],
      },
      snapshot([a, b], [edge]),
    );
    expect(edges.upsertEdges).toEqual([edge]);
    expect(edges.removeEdgeIds).toHaveLength(1);
  });

  it('undoes and redoes board changes, merging rapid edits and keeping creations apart', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(0);
    const api = await bootTestApp();
    const project = makeProject('History');
    api.projects = [project];
    api.current = project;
    api.emitProject();
    const board = await createBoard({ name: 'Undo' });
    await loadBoard(board.id);
    const item = { ...node('item', 0, 0), boardId: board.id };
    const at = () => getBoardNodes(board.id).find((candidate) => candidate.id === 'item')?.x;

    await commitChanges(board.id, { upsertNodes: [item] });
    vi.setSystemTime(300);
    await commitChanges(board.id, { upsertNodes: [{ ...item, x: 10 }] });
    vi.setSystemTime(500);
    await commitChanges(board.id, { upsertNodes: [{ ...item, x: 20 }] });
    vi.setSystemTime(3000);
    await commitChanges(board.id, { upsertNodes: [{ ...item, x: 30 }] });
    await commitChanges(board.id, { upsertNodes: [{ ...item, x: 99 }] }, { history: false });
    expect(historyState(board.id)).toEqual({ canUndo: true, canRedo: false });

    expect(await undoBoard(board.id)).toBe(true);
    expect(at()).toBe(20);
    expect(await undoBoard(board.id)).toBe(true);
    expect(at()).toBe(0);
    expect(await undoBoard(board.id)).toBe(true);
    expect(at()).toBeUndefined();
    expect(await undoBoard(board.id)).toBe(false);
    expect(historyState(board.id)).toEqual({ canUndo: false, canRedo: true });

    expect(await redoBoard(board.id)).toBe(true);
    expect(at()).toBe(0);
    expect(await redoBoard(board.id)).toBe(true);
    expect(at()).toBe(20);
    vi.setSystemTime(9000);
    await commitChanges(board.id, { upsertNodes: [{ ...item, x: 5 }] });
    expect(historyState(board.id).canRedo).toBe(false);
    expect(await redoBoard(board.id)).toBe(false);
  });
});
