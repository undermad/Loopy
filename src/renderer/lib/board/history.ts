import type { BoardChanges, BoardEdge, BoardNode, BoardSnapshot } from '@shared/board';
import { descendants } from './items';

interface Entry {
  undo: BoardChanges[];
  redo: BoardChanges[];
  at: number;
  key: string;
  upsertOnly: boolean;
}

interface Stacks {
  past: Entry[];
  future: Entry[];
}

const LIMIT = 200;
const GROUP_MS = 80;
const COALESCE_MS = 500;

const stacks = new Map<string, Stacks>();

function stacksFor(boardId: string): Stacks {
  let entry = stacks.get(boardId);
  if (!entry) {
    entry = { past: [], future: [] };
    stacks.set(boardId, entry);
  }
  return entry;
}

function keyOf(changes: BoardChanges): string {
  const ids = [
    ...(changes.upsertNodes ?? []).map((node) => `n:${node.id}`),
    ...(changes.removeNodeIds ?? []).map((id) => `-n:${id}`),
    ...(changes.upsertEdges ?? []).map((edge) => `e:${edge.id}`),
    ...(changes.removeEdgeIds ?? []).map((id) => `-e:${id}`),
  ];
  return ids.sort().join('|');
}

function isEmpty(changes: BoardChanges): boolean {
  return (
    (changes.upsertNodes?.length ?? 0) === 0 &&
    (changes.removeNodeIds?.length ?? 0) === 0 &&
    (changes.upsertEdges?.length ?? 0) === 0 &&
    (changes.removeEdgeIds?.length ?? 0) === 0
  );
}

export function inverseChanges(changes: BoardChanges, before: BoardSnapshot): BoardChanges {
  const nodeById = new Map(before.nodes.map((node) => [node.id, node]));
  const edgeById = new Map(before.edges.map((edge) => [edge.id, edge]));
  const removed = new Set(
    (changes.removeNodeIds ?? []).flatMap((id) =>
      nodeById.has(id) ? [id, ...descendants(id, before.nodes)] : [],
    ),
  );
  const restoreNodes = new Map<string, BoardNode>();
  const removeNodeIds: string[] = [];
  for (const node of changes.upsertNodes ?? []) {
    const previous = nodeById.get(node.id);
    if (previous) restoreNodes.set(node.id, previous);
    else removeNodeIds.push(node.id);
  }
  for (const id of removed) {
    const previous = nodeById.get(id);
    if (previous) restoreNodes.set(id, previous);
  }
  const restoreEdges = new Map<string, BoardEdge>();
  const removeEdgeIds: string[] = [];
  for (const edge of changes.upsertEdges ?? []) {
    const previous = edgeById.get(edge.id);
    if (previous) restoreEdges.set(edge.id, previous);
    else removeEdgeIds.push(edge.id);
  }
  for (const id of changes.removeEdgeIds ?? []) {
    const previous = edgeById.get(id);
    if (previous) restoreEdges.set(id, previous);
  }
  for (const edge of before.edges) {
    if (removed.has(edge.sourceId) || removed.has(edge.targetId)) restoreEdges.set(edge.id, edge);
  }
  return {
    upsertNodes: [...restoreNodes.values()],
    removeNodeIds,
    upsertEdges: [...restoreEdges.values()],
    removeEdgeIds,
  };
}

export function recordChanges(boardId: string, changes: BoardChanges, before: BoardSnapshot): void {
  if (isEmpty(changes)) return;
  const history = stacksFor(boardId);
  const undo = inverseChanges(changes, before);
  const at = Date.now();
  const key = keyOf(changes);
  const upsertOnly =
    (changes.removeNodeIds?.length ?? 0) === 0 &&
    (changes.removeEdgeIds?.length ?? 0) === 0 &&
    (undo.removeNodeIds?.length ?? 0) === 0 &&
    (undo.removeEdgeIds?.length ?? 0) === 0;
  const last = history.past.at(-1);
  history.future = [];
  if (
    last &&
    (at - last.at < GROUP_MS ||
      (upsertOnly && last.upsertOnly && last.key === key && at - last.at < COALESCE_MS))
  ) {
    last.undo = [undo, ...last.undo];
    last.redo = [...last.redo, changes];
    last.at = at;
    last.key = last.key === key ? key : `${last.key}+${key}`;
    last.upsertOnly = last.upsertOnly && upsertOnly;
    return;
  }
  history.past.push({ undo: [undo], redo: [changes], at, key, upsertOnly });
  if (history.past.length > LIMIT) history.past.shift();
}

export function takeUndo(boardId: string): BoardChanges[] | null {
  const history = stacksFor(boardId);
  const entry = history.past.pop();
  if (!entry) return null;
  history.future.push(entry);
  const previous = history.past.at(-1);
  if (previous) previous.at = 0;
  return entry.undo;
}

export function takeRedo(boardId: string): BoardChanges[] | null {
  const history = stacksFor(boardId);
  const entry = history.future.pop();
  if (!entry) return null;
  entry.at = 0;
  history.past.push(entry);
  return entry.redo;
}

export function historyState(boardId: string): { canUndo: boolean; canRedo: boolean } {
  const history = stacks.get(boardId);
  return { canUndo: (history?.past.length ?? 0) > 0, canRedo: (history?.future.length ?? 0) > 0 };
}

export function clearHistory(): void {
  stacks.clear();
}
