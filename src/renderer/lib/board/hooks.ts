import { useStore } from 'zustand';
import type { Board, BoardSnapshot } from '@shared/board';
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
