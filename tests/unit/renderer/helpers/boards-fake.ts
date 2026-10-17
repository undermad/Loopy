import { vi } from 'vitest';
import {
  DEFAULT_BOARD_BACKGROUND,
  boardChangesSchema,
  boardInputSchema,
  type Board,
  type BoardPatch,
  type BoardSnapshot,
} from '@shared/board';
import type { LoopyApi } from '@shared/ipc';

export type BoardsFakeApi = Pick<
  LoopyApi,
  'listBoards' | 'createBoard' | 'updateBoard' | 'deleteBoard' | 'readBoard' | 'applyBoardChanges'
>;

export function createBoardsFake() {
  const data = { boards: [] as Board[], snapshots: new Map<string, BoardSnapshot>() };
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
      const edges = [...snapshot.edges.filter((edge) => !removedEdges.has(edge.id)), ...changes.upsertEdges];
      const next = { ...snapshot, nodes, edges };
      data.snapshots.set(id, next);
      return Promise.resolve(structuredClone(next));
    }),
  };
  return { api, data };
}
