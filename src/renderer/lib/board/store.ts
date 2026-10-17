import { createStore } from 'zustand/vanilla';
import type { Board, BoardChanges, BoardInput, BoardNode, BoardPatch, BoardSnapshot } from '@shared/board';
import type { LoopyApi } from '@shared/ipc';
import { subscribeCurrentProject } from '@renderer/lib/project';

export type BoardApi = Pick<
  LoopyApi,
  'listBoards' | 'createBoard' | 'updateBoard' | 'deleteBoard' | 'readBoard' | 'applyBoardChanges'
>;

export interface BoardState {
  boards: Board[] | null;
  snapshots: Record<string, BoardSnapshot>;
  api: BoardApi | null;
}

export const boardStore = createStore<BoardState>(() => ({ boards: null, snapshots: {}, api: null }));

function requireApi(): BoardApi {
  const { api } = boardStore.getState();
  if (!api) throw new Error('Boards are not loaded');
  return api;
}

let loadToken = 0;

export async function loadBoards(): Promise<Board[]> {
  loadToken += 1;
  const token = loadToken;
  const boards = await requireApi().listBoards();
  if (token === loadToken) boardStore.setState({ boards });
  return boards;
}

export async function bootBoards(api: BoardApi, hasProject: boolean): Promise<void> {
  boardStore.setState({ api });
  if (hasProject) await loadBoards();
  subscribeCurrentProject((project) => {
    boardStore.setState({ boards: null, snapshots: {} });
    if (project) void loadBoards();
  });
}

function storeSnapshot(snapshot: BoardSnapshot): void {
  loadToken += 1;
  const { snapshots, boards } = boardStore.getState();
  boardStore.setState({
    snapshots: { ...snapshots, [snapshot.board.id]: snapshot },
    boards: boards?.map((board) => (board.id === snapshot.board.id ? snapshot.board : board)) ?? boards,
  });
}

export async function loadBoard(id: string): Promise<BoardSnapshot> {
  const snapshot = await requireApi().readBoard(id);
  storeSnapshot(snapshot);
  return snapshot;
}

export async function createBoard(input: BoardInput): Promise<Board> {
  const board = await requireApi().createBoard(input);
  await loadBoards();
  return board;
}

export async function updateBoard(id: string, patch: BoardPatch): Promise<Board> {
  const board = await requireApi().updateBoard(id, patch);
  const { snapshots } = boardStore.getState();
  const existing = snapshots[id];
  if (existing) storeSnapshot({ ...existing, board });
  else await loadBoards();
  return board;
}

export async function deleteBoard(id: string): Promise<Board[]> {
  const boards = await requireApi().deleteBoard(id);
  loadToken += 1;
  const { snapshots } = boardStore.getState();
  const { [id]: _removed, ...rest } = snapshots;
  boardStore.setState({ boards, snapshots: rest });
  return boards;
}

export function applyLocalChanges(boardId: string, changes: BoardChanges): void {
  const { snapshots } = boardStore.getState();
  const existing = snapshots[boardId];
  if (!existing) return;
  const removeNodes = new Set(changes.removeNodeIds ?? []);
  const removeEdges = new Set(changes.removeEdgeIds ?? []);
  const nodeUpdates = new Map((changes.upsertNodes ?? []).map((node) => [node.id, node]));
  const nodes: BoardNode[] = existing.nodes
    .filter((node) => !removeNodes.has(node.id))
    .map((node) => nodeUpdates.get(node.id) ?? node);
  for (const node of nodeUpdates.values())
    if (!nodes.some((candidate) => candidate.id === node.id)) nodes.push(node);
  const edgeUpdates = new Map((changes.upsertEdges ?? []).map((edge) => [edge.id, edge]));
  const edges = existing.edges
    .filter(
      (edge) =>
        !removeEdges.has(edge.id) && !removeNodes.has(edge.sourceId) && !removeNodes.has(edge.targetId),
    )
    .map((edge) => edgeUpdates.get(edge.id) ?? edge);
  for (const edge of edgeUpdates.values())
    if (!edges.some((candidate) => candidate.id === edge.id)) edges.push(edge);
  storeSnapshot({ ...existing, nodes, edges });
}

export async function commitChanges(boardId: string, changes: BoardChanges): Promise<void> {
  applyLocalChanges(boardId, changes);
  storeSnapshot(await requireApi().applyBoardChanges(boardId, changes));
}

export function resetBoardStore(): void {
  boardStore.setState({ boards: null, snapshots: {}, api: null });
}
