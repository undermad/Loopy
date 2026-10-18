import { vi } from 'vitest';
import {
  DEFAULT_BOARD_BACKGROUND,
  DEFAULT_BOARD_GRID,
  DEFAULT_BOARD_UNIT,
  DEFAULT_BOARD_UNIT_SCALE,
  boardChangesSchema,
  boardInputSchema,
  type Board,
  type BoardPatch,
  type BoardSnapshot,
  type BoardTile,
} from '@shared/board';
import type { LoopyApi } from '@shared/ipc';

export type BoardsFakeApi = Pick<
  LoopyApi,
  | 'listBoards'
  | 'createBoard'
  | 'updateBoard'
  | 'deleteBoard'
  | 'readBoard'
  | 'applyBoardChanges'
  | 'readBoardTiles'
>;

export function createBoardsFake() {
  const data = {
    boards: [] as Board[],
    snapshots: new Map<string, BoardSnapshot>(),
    tiles: new Map<string, BoardTile>(),
  };
  const tileId = (tile: Pick<BoardTile, 'nodeId' | 'tx' | 'ty'>) =>
    `${tile.nodeId}:${String(tile.tx)}:${String(tile.ty)}`;
  const stamp = '2026-10-17T09:00:00.000Z';
  const find = (id: string): BoardSnapshot => {
    const snapshot = data.snapshots.get(id);
    if (!snapshot) throw new Error(`Unknown board ${id}`);
    return snapshot;
  };
  const api: BoardsFakeApi = {
    listBoards: vi.fn(() => Promise.resolve([...data.boards])),
    createBoard: vi.fn((raw: unknown) => {
      const input = boardInputSchema.parse(raw);
      const board: Board = {
        id: `board-${String(data.boards.length + 1)}`,
        name: input.name,
        backgroundColor: input.backgroundColor ?? DEFAULT_BOARD_BACKGROUND,
        gridColor: input.gridColor ?? DEFAULT_BOARD_GRID,
        backgroundRef: input.backgroundRef ?? null,
        gridRef: input.gridRef ?? null,
        unit: input.unit ?? DEFAULT_BOARD_UNIT,
        unitScale: input.unitScale ?? DEFAULT_BOARD_UNIT_SCALE,
        folderId: null,
        createdAt: stamp,
        updatedAt: stamp,
      };
      data.boards.push(board);
      data.snapshots.set(board.id, { board, nodes: [], edges: [] });
      return Promise.resolve(board);
    }),
    updateBoard: vi.fn((id: string, patch: BoardPatch) => {
      const snapshot = find(id);
      const board: Board = {
        ...snapshot.board,
        name: patch.name ?? snapshot.board.name,
        backgroundColor: patch.backgroundColor ?? snapshot.board.backgroundColor,
        gridColor: patch.gridColor ?? snapshot.board.gridColor,
        backgroundRef: patch.backgroundRef === undefined ? snapshot.board.backgroundRef : patch.backgroundRef,
        gridRef: patch.gridRef === undefined ? snapshot.board.gridRef : patch.gridRef,
        unit: patch.unit ?? snapshot.board.unit,
        unitScale: patch.unitScale ?? snapshot.board.unitScale,
        folderId: patch.folderId === undefined ? snapshot.board.folderId : patch.folderId,
      };
      data.snapshots.set(id, { ...snapshot, board });
      data.boards = data.boards.map((item) => (item.id === id ? board : item));
      return Promise.resolve(board);
    }),
    deleteBoard: vi.fn((id: string) => {
      data.snapshots.delete(id);
      data.boards = data.boards.filter((item) => item.id !== id);
      return Promise.resolve([...data.boards]);
    }),
    readBoard: vi.fn((id: string) => Promise.resolve(structuredClone(find(id)))),
    applyBoardChanges: vi.fn((id: string, raw: unknown) => {
      const changes = boardChangesSchema.parse(raw);
      const snapshot = find(id);
      const removed = new Set(changes.removeNodeIds);
      const nodes = [...snapshot.nodes.filter((node) => !removed.has(node.id))];
      for (const node of changes.upsertNodes) {
        const index = nodes.findIndex((candidate) => candidate.id === node.id);
        if (index >= 0) nodes[index] = node;
        else nodes.push(node);
      }
      const removedEdges = new Set(changes.removeEdgeIds);
      const updatedEdges = new Set(changes.upsertEdges.map((edge) => edge.id));
      const edges = [
        ...snapshot.edges.filter(
          (edge) =>
            !removedEdges.has(edge.id) &&
            !updatedEdges.has(edge.id) &&
            !removed.has(edge.sourceId) &&
            !removed.has(edge.targetId),
        ),
        ...changes.upsertEdges,
      ];
      const next = { ...snapshot, nodes, edges };
      data.snapshots.set(id, next);
      for (const [key, tile] of data.tiles) if (removed.has(tile.nodeId)) data.tiles.delete(key);
      for (const tile of changes.removeTiles) data.tiles.delete(tileId(tile));
      for (const tile of changes.upsertTiles) {
        if (!nodes.some((node) => node.id === tile.nodeId && node.type === 'drawing'))
          return Promise.reject(new Error(`Tile for unknown drawing ${tile.nodeId}`));
        data.tiles.set(tileId(tile), tile);
      }
      return Promise.resolve(structuredClone(next));
    }),
    readBoardTiles: vi.fn((id: string) => {
      const nodes = new Set(find(id).nodes.map((node) => node.id));
      return Promise.resolve([...data.tiles.values()].filter((tile) => nodes.has(tile.nodeId)));
    }),
  };
  return { api, data };
}
