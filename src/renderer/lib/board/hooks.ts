import { useStore } from 'zustand';
import type { Board, BoardNode, BoardSnapshot } from '@shared/board';
import { historyState } from './history';
import { boardStore, type BoardSelection } from './store';

export function useBoards(): Board[] | null {
  return useStore(boardStore, (state) => state.boards);
}

export function useBoardSnapshot(id: string | null): BoardSnapshot | null {
  return useStore(boardStore, (state) => (id ? (state.snapshots[id] ?? null) : null));
}

export function useActiveBoardId(): string | null {
  return useStore(boardStore, (state) => state.activeBoardId);
}

export function useBoardSelection(): BoardSelection | null {
  return useStore(boardStore, (state) => state.selection);
}

export function useLiveNode(node: BoardNode): BoardNode {
  const live = useStore(boardStore, (state) => state.live[node.id]);
  return live ? { ...node, ...live } : node;
}

export function useBoardHistory(boardId: string): { canUndo: boolean; canRedo: boolean } {
  useStore(boardStore, (state) => state.history);
  return historyState(boardId);
}

export function useLiveLayers(): Record<string, number> {
  return useStore(boardStore, (state) => state.liveLayers);
}
