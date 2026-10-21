import { useCallback, useState } from 'react';
import { pushHistory, redoHistory, startHistory, undoHistory, type History } from './history';

export interface HistoryHandle<T> {
  value: T;
  set: (next: T | ((value: T) => T), key?: string | null) => void;
  undo: () => void;
  redo: () => void;
  reset: (value: T) => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useHistory<T>(initial: T): HistoryHandle<T> {
  const [history, setHistory] = useState<History<T>>(() => startHistory(initial));
  const set = useCallback((next: T | ((value: T) => T), key: string | null = null) => {
    setHistory((own) => {
      const value = typeof next === 'function' ? (next as (value: T) => T)(own.present) : next;
      return pushHistory(own, value, key, Date.now());
    });
  }, []);
  const undo = useCallback(() => {
    setHistory(undoHistory);
  }, []);
  const redo = useCallback(() => {
    setHistory(redoHistory);
  }, []);
  const reset = useCallback((value: T) => {
    setHistory(startHistory(value));
  }, []);
  return {
    value: history.present,
    set,
    undo,
    redo,
    reset,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
