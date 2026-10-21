export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  key: string | null;
  at: number;
}

const LIMIT = 100;
const MERGE_MS = 1000;

export function startHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], key: null, at: 0 };
}

export function pushHistory<T>(history: History<T>, next: T, key: string | null, now: number): History<T> {
  if (Object.is(next, history.present)) return history;
  if (key !== null && key === history.key && now - history.at < MERGE_MS) {
    return { ...history, present: next, future: [], at: now };
  }
  return {
    past: [...history.past, history.present].slice(-LIMIT),
    present: next,
    future: [],
    key,
    at: now,
  };
}

export function undoHistory<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1);
  if (history.past.length === 0) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous as T,
    future: [history.present, ...history.future],
    key: null,
    at: 0,
  };
}

export function redoHistory<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history;
  const [next, ...future] = history.future;
  return { past: [...history.past, history.present], present: next as T, future, key: null, at: 0 };
}
