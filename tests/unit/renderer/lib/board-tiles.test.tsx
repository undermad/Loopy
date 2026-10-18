import { act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BoardNode, BoardSnapshot, BoardTile } from '@shared/board';
import {
  commitChanges,
  copyItems,
  copyTiles,
  createBoard,
  duplicateItems,
  getBoardTiles,
  historyState,
  inverseChanges,
  isDrawing,
  itemAt,
  loadBoard,
  pasteItems,
  subscribeBoardTiles,
  tileKey,
  undoBoard,
} from '@renderer/lib/board';
import { bootTestApp, makeProject } from '../helpers/api';

function node(id: string, extra: Partial<BoardNode> = {}): BoardNode {
  return {
    id,
    boardId: 'b',
    parentId: null,
    type: 'drawing',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    z: 1,
    data: {},
    ...extra,
  };
}

function tile(nodeId: string, tx: number, ty: number, ...bytes: number[]): BoardTile {
  return { nodeId, tx, ty, bytes: new Uint8Array(bytes.length > 0 ? bytes : [1]) };
}

function snapshot(nodes: BoardNode[]): BoardSnapshot {
  return {
    board: {
      id: 'b',
      name: 'Board',
      backgroundColor: '#ffffff',
      gridColor: '#808080',
      backgroundRef: null,
      gridRef: null,
      unit: 'm',
      unitScale: 100,
      folderId: null,
      createdAt: '2026-10-17T09:00:00.000Z',
      updatedAt: '2026-10-17T09:00:00.000Z',
    },
    nodes,
    edges: [],
  };
}

async function openBoard(): Promise<{ boardId: string }> {
  const api = await bootTestApp();
  const project = makeProject('Tiles');
  api.projects = [project];
  api.current = project;
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
  const board = await createBoard({ name: 'Tiles' });
  await loadBoard(board.id);
  return { boardId: board.id };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('drawing tiles in the board library', () => {
  it('inverts tile writes, tile removals and removed layers', () => {
    const layer = node('ink');
    const old = tile('ink', 0, 0, 1);
    const before = { [tileKey(old)]: old, [tileKey(tile('ink', 1, 0, 2))]: tile('ink', 1, 0, 2) };
    const inverse = inverseChanges(
      {
        upsertTiles: [tile('ink', 0, 0, 9), tile('ink', 5, 5, 9)],
        removeTiles: [
          { nodeId: 'ink', tx: 1, ty: 0 },
          { nodeId: 'ink', tx: 7, ty: 7 },
        ],
      },
      snapshot([layer]),
      before,
    );
    expect(inverse.upsertTiles?.map((item) => [item.tx, [...item.bytes]])).toEqual([
      [0, [1]],
      [1, [2]],
    ]);
    expect(inverse.removeTiles).toEqual([{ nodeId: 'ink', tx: 5, ty: 5 }]);
    const removal = inverseChanges({ removeNodeIds: ['ink'] }, snapshot([layer]), before);
    expect(removal.upsertNodes).toEqual([layer]);
    expect(removal.upsertTiles).toHaveLength(2);
    expect(inverseChanges({ upsertTiles: [tile('ink', 0, 0)] }, snapshot([layer])).removeTiles).toHaveLength(
      1,
    );
  });

  it('copies tiles to duplicated and pasted layers and leaves them out of the system clipboard', () => {
    const layer = node('ink');
    const text = node('note', { type: 'text' });
    const tiles = { a: tile('ink', 0, 0, 3), b: tile('note', 0, 0, 4) };
    const copies = duplicateItems(['ink'], [layer, text], []);
    const copyId = copies.ids[0] ?? '';
    expect(copies.sources.get(copyId)).toBe('ink');
    expect(copyTiles(copies.sources, tiles)).toEqual([{ ...tiles.a, nodeId: copyId }]);

    const clip = copyItems(['ink'], [layer, text], [], tiles);
    expect(clip.tiles).toEqual([tiles.a]);
    const pasted = pasteItems(clip, 'other', { x: 10, y: 10 }, []);
    expect(pasted.tiles.map((item) => item.nodeId)).toEqual(pasted.ids);
    const { tiles: _tiles, ...plain } = clip;
    expect(pasteItems(plain, 'other', null, []).tiles).toEqual([]);
  });

  it('skips drawings when hit testing items', () => {
    const layer = node('ink', { z: 9 });
    const text = node('note', { type: 'text' });
    expect(isDrawing(layer)).toBe(true);
    expect(isDrawing(text)).toBe(false);
    expect(itemAt({ x: 10, y: 10 }, [layer, text])?.id).toBe('note');
  });

  it('loads tiles with a board, drops them with their layer and keeps paint steps apart in history', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(0);
    const { boardId } = await openBoard();
    const seen: string[] = [];
    const stop = subscribeBoardTiles((id, tiles) => {
      seen.push(`${id}:${String(Object.keys(tiles).length)}`);
    });
    const layer = { ...node('ink'), boardId };
    await commitChanges(boardId, { upsertNodes: [layer], upsertTiles: [tile('ink', 0, 0, 1)] });
    vi.setSystemTime(10);
    await commitChanges(boardId, { upsertTiles: [tile('ink', 0, 0, 2)] });
    expect(historyState(boardId).canUndo).toBe(true);
    await loadBoard(boardId);
    expect(Object.keys(getBoardTiles(boardId))).toEqual(['ink:0:0']);

    await undoBoard(boardId);
    expect([...(getBoardTiles(boardId)['ink:0:0']?.bytes ?? [])]).toEqual([1]);
    await commitChanges(boardId, { removeNodeIds: ['ink'] });
    expect(getBoardTiles(boardId)).toEqual({});
    await undoBoard(boardId);
    expect([...(getBoardTiles(boardId)['ink:0:0']?.bytes ?? [])]).toEqual([1]);
    expect(seen.at(-1)).toBe(`${boardId}:1`);
    stop();
  });

  it('drops the oldest paint steps when undo holds too many tile bytes', async () => {
    const { boardId } = await openBoard();
    const layer = { ...node('ink'), boardId };
    await commitChanges(boardId, { upsertNodes: [layer] }, { history: false });
    const big = new Uint8Array(7 * 1024 * 1024);
    for (let step = 0; step < 38; step += 1) {
      await commitChanges(boardId, { upsertTiles: [{ nodeId: 'ink', tx: step, ty: 0, bytes: big }] });
    }
    for (let step = 0; step < 36; step += 1) await undoBoard(boardId);
    expect(historyState(boardId).canUndo).toBe(false);
    expect(Object.keys(getBoardTiles(boardId)).sort()).toEqual(['ink:0:0', 'ink:1:0']);
  });
});
