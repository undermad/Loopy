import { createStore } from 'zustand/vanilla';
import type {
  Board,
  BoardChanges,
  BoardInput,
  BoardNode,
  BoardPatch,
  BoardSnapshot,
  BoardTile,
} from '@shared/board';
import type { LoopyApi } from '@shared/ipc';
import { subscribeCurrentProject } from '@renderer/lib/project';
import { dockOf, settleDocks } from './docking';
import { clearHistory, recordChanges, takeRedo, takeUndo, tileKey } from './history';

export type BoardApi = Pick<
  LoopyApi,
  | 'listBoards'
  | 'createBoard'
  | 'updateBoard'
  | 'deleteBoard'
  | 'readBoard'
  | 'applyBoardChanges'
  | 'readBoardTiles'
>;

export type TileMap = Record<string, BoardTile>;

export interface BoardBase {
  snapshot: BoardSnapshot;
  tiles: TileMap;
}

export interface BoardSelection {
  boardId: string;
  nodeIds: string[];
  edgeIds: string[];
}

export type LiveGeometry = Pick<BoardNode, 'x' | 'y' | 'width' | 'height'>;

export interface BoardState {
  boards: Board[] | null;
  snapshots: Record<string, BoardSnapshot>;
  tiles: Record<string, TileMap>;
  api: BoardApi | null;
  activeBoardId: string | null;
  selection: BoardSelection | null;
  live: Record<string, LiveGeometry>;
  liveLayers: Record<string, number>;
  history: number;
}

const EMPTY: Omit<BoardState, 'api'> = {
  boards: null,
  snapshots: {},
  tiles: {},
  activeBoardId: null,
  selection: null,
  live: {},
  liveLayers: {},
  history: 0,
};

export function setLiveGeometry(updates: Record<string, LiveGeometry | null>): void {
  const live: Record<string, LiveGeometry> = {};
  for (const [id, geometry] of Object.entries({ ...boardStore.getState().live, ...updates })) {
    if (geometry) live[id] = geometry;
  }
  boardStore.setState({ live });
}

export const boardStore = createStore<BoardState>(() => ({ ...EMPTY, api: null }));

export function setLiveLayers(nodes: BoardNode[] | null): void {
  boardStore.setState({ liveLayers: Object.fromEntries((nodes ?? []).map((node) => [node.id, node.z])) });
}

export function setActiveBoard(boardId: string | null): void {
  if (boardStore.getState().activeBoardId !== boardId) boardStore.setState({ activeBoardId: boardId });
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export function setBoardSelection(boardId: string, nodeIds: string[], edgeIds: string[] = []): void {
  const current = boardStore.getState().selection;
  const same =
    current?.boardId === boardId && sameIds(current.nodeIds, nodeIds) && sameIds(current.edgeIds, edgeIds);
  if (same) return;
  const empty = nodeIds.length === 0 && edgeIds.length === 0;
  boardStore.setState({ selection: empty ? null : { boardId, nodeIds, edgeIds } });
}

export function getBoardNodes(boardId: string): BoardNode[] {
  return boardStore.getState().snapshots[boardId]?.nodes ?? [];
}

export function getBoardSelection(boardId: string): { nodeIds: string[]; edgeIds: string[] } {
  const current = boardStore.getState().selection;
  return current?.boardId === boardId ? current : { nodeIds: [], edgeIds: [] };
}

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
    boardStore.setState({ ...EMPTY });
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

export async function refreshBoards(): Promise<void> {
  await loadBoards();
  await Promise.all(Object.keys(boardStore.getState().snapshots).map((id) => loadBoard(id)));
}

function storeTiles(boardId: string, tiles: TileMap): void {
  boardStore.setState((state) => ({ tiles: { ...state.tiles, [boardId]: tiles } }));
}

export async function loadBoard(id: string): Promise<BoardSnapshot> {
  const api = requireApi();
  const [snapshot, tiles] = await Promise.all([api.readBoard(id), api.readBoardTiles(id)]);
  storeTiles(id, Object.fromEntries(tiles.map((tile) => [tileKey(tile), tile])));
  storeSnapshot(snapshot);
  return snapshot;
}

export function getBoardTiles(boardId: string): TileMap {
  return boardStore.getState().tiles[boardId] ?? {};
}

export function subscribeBoardTiles(listener: (boardId: string, tiles: TileMap) => void): () => void {
  return boardStore.subscribe((state, previous) => {
    if (state.tiles === previous.tiles) return;
    for (const [boardId, tiles] of Object.entries(state.tiles)) {
      if (previous.tiles[boardId] !== tiles) listener(boardId, tiles);
    }
    for (const boardId of Object.keys(previous.tiles)) if (!(boardId in state.tiles)) listener(boardId, {});
  });
}

export function captureBoard(boardId: string): BoardBase | null {
  const snapshot = boardStore.getState().snapshots[boardId];
  return snapshot ? { snapshot, tiles: getBoardTiles(boardId) } : null;
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
  const { snapshots, tiles } = boardStore.getState();
  const { [id]: _removed, ...rest } = snapshots;
  const { [id]: _removedTiles, ...restTiles } = tiles;
  const { activeBoardId, selection } = boardStore.getState();
  boardStore.setState({
    boards,
    snapshots: rest,
    tiles: restTiles,
    activeBoardId: activeBoardId === id ? null : activeBoardId,
    selection: selection?.boardId === id ? null : selection,
  });
  return boards;
}

function nextNodes(current: BoardNode[], changes: BoardChanges): BoardNode[] {
  const removeNodes = new Set(changes.removeNodeIds ?? []);
  const nodeUpdates = new Map((changes.upsertNodes ?? []).map((node) => [node.id, node]));
  const nodes: BoardNode[] = current
    .filter((node) => !removeNodes.has(node.id))
    .map((node) => nodeUpdates.get(node.id) ?? node);
  for (const node of nodeUpdates.values())
    if (!nodes.some((candidate) => candidate.id === node.id)) nodes.push(node);
  return nodes;
}

function withSettledDocks(current: BoardNode[], changes: BoardChanges): BoardChanges {
  const byId = new Map(current.map((node) => [node.id, node]));
  const docks = new Set<string>();
  const note = (node: BoardNode | undefined) => {
    const dock = node ? dockOf(node) : null;
    if (dock) docks.add(dock);
  };
  for (const id of changes.removeNodeIds ?? []) note(byId.get(id));
  for (const node of changes.upsertNodes ?? []) {
    note(node);
    note(byId.get(node.id));
  }
  if (docks.size === 0) return changes;
  const fixes = settleDocks(nextNodes(current, changes), docks);
  if (fixes.length === 0) return changes;
  const fixed = new Map(fixes.map((node) => [node.id, node]));
  const upsertNodes = (changes.upsertNodes ?? []).map((node) => fixed.get(node.id) ?? node);
  for (const node of fixes)
    if (!upsertNodes.some((candidate) => candidate.id === node.id)) upsertNodes.push(node);
  return { ...changes, upsertNodes };
}

export function applyLocalChanges(boardId: string, changes: BoardChanges): void {
  const { snapshots } = boardStore.getState();
  const existing = snapshots[boardId];
  if (!existing) return;
  const removeNodes = new Set(changes.removeNodeIds ?? []);
  const removeEdges = new Set(changes.removeEdgeIds ?? []);
  const nodes = nextNodes(existing.nodes, changes);
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
  const tiles = nextTiles(getBoardTiles(boardId), changes, removeNodes);
  if (tiles) storeTiles(boardId, tiles);
}

function nextTiles(current: TileMap, changes: BoardChanges, removedNodes: Set<string>): TileMap | null {
  const removeTiles = changes.removeTiles ?? [];
  const upsertTiles = changes.upsertTiles ?? [];
  const orphaned = Object.values(current).some((tile) => removedNodes.has(tile.nodeId));
  if (removeTiles.length === 0 && upsertTiles.length === 0 && !orphaned) return null;
  const tiles = new Map(Object.entries(current).filter(([, tile]) => !removedNodes.has(tile.nodeId)));
  for (const tile of removeTiles) tiles.delete(tileKey(tile));
  for (const tile of upsertTiles) tiles.set(tileKey(tile), tile);
  return Object.fromEntries(tiles);
}

const pendingWork = new Map<string, Promise<unknown>>();

export function trackBoardWork(boardId: string, work: Promise<unknown>): void {
  const previous = pendingWork.get(boardId) ?? Promise.resolve();
  const next = previous.then(
    () => work,
    () => work,
  );
  pendingWork.set(boardId, next);
  void next.finally(() => {
    if (pendingWork.get(boardId) === next) pendingWork.delete(boardId);
  });
}

async function settleWork(boardId: string): Promise<void> {
  await pendingWork.get(boardId)?.catch(() => undefined);
}

export async function commitChanges(
  boardId: string,
  requested: BoardChanges,
  options: { history?: boolean; base?: BoardBase | null } = {},
): Promise<void> {
  const current = boardStore.getState().snapshots[boardId];
  const before = options.base?.snapshot ?? current;
  const changes = current ? withSettledDocks(current.nodes, requested) : requested;
  if (before && options.history !== false) {
    recordChanges(boardId, changes, before, options.base?.tiles ?? getBoardTiles(boardId));
    boardStore.setState((state) => ({ history: state.history + 1 }));
  }
  applyLocalChanges(boardId, changes);
  storeSnapshot(await requireApi().applyBoardChanges(boardId, changes));
}

async function replay(boardId: string, steps: BoardChanges[] | null): Promise<boolean> {
  if (!steps) return false;
  boardStore.setState((state) => ({ history: state.history + 1 }));
  await Promise.all(steps.map((step) => commitChanges(boardId, step, { history: false })));
  return true;
}

export async function undoBoard(boardId: string): Promise<boolean> {
  await settleWork(boardId);
  return replay(boardId, takeUndo(boardId));
}

export async function redoBoard(boardId: string): Promise<boolean> {
  await settleWork(boardId);
  return replay(boardId, takeRedo(boardId));
}

export function resetBoardStore(): void {
  clearHistory();
  boardStore.setState({ ...EMPTY, api: null });
}
