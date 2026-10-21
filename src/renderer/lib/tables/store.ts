import { useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { LoopyApi } from '@shared/ipc';
import type {
  DataTable,
  DataTableInput,
  DataTablePatch,
  DataTableSummary,
  RowChanges,
  RowOp,
  TableLookup,
  TableRow,
  TableSnapshot,
} from '@shared/tables';
import { subscribeCurrentProject } from '@renderer/lib/project';
import { inverseOps } from './history';

export type TablesApi = Pick<
  LoopyApi,
  | 'listTables'
  | 'readTable'
  | 'createTable'
  | 'updateTable'
  | 'duplicateTable'
  | 'deleteTable'
  | 'patchTableRows'
>;

type Action = { type: 'rows'; ops: RowOp[] } | { type: 'table'; patch: DataTablePatch };

interface Entry {
  forward: Action;
  backward: Action;
}

interface History {
  undo: Entry[];
  redo: Entry[];
}

interface TablesState {
  api: TablesApi | null;
  summaries: DataTableSummary[] | null;
  snapshots: Record<string, TableSnapshot>;
  missing: Record<string, true>;
  history: Record<string, History>;
}

const HISTORY_LIMIT = 200;
const EMPTY: History = { undo: [], redo: [] };

const tablesStore = createStore<TablesState>(() => ({
  api: null,
  summaries: null,
  snapshots: {},
  missing: {},
  history: {},
}));

let loadToken = 0;
const pending = new Map<string, Promise<TableSnapshot | null>>();

function requireApi(): TablesApi {
  const { api } = tablesStore.getState();
  if (!api) throw new Error('Tables are not loaded');
  return api;
}

function sorted(list: DataTableSummary[]): DataTableSummary[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

function byPosition(a: TableRow, b: TableRow): number {
  if (a.position === b.position) return a.id < b.id ? -1 : 1;
  return a.position < b.position ? -1 : 1;
}

function putSummary(table: DataTable, rowCount?: number): void {
  const list = tablesStore.getState().summaries ?? [];
  const existing = list.find((item) => item.id === table.id);
  const summary = { ...table, rowCount: rowCount ?? existing?.rowCount ?? 0 };
  tablesStore.setState({ summaries: sorted([...list.filter((item) => item.id !== table.id), summary]) });
}

function putSnapshot(snapshot: TableSnapshot): void {
  const { snapshots, missing } = tablesStore.getState();
  const { [snapshot.table.id]: _found, ...rest } = missing;
  tablesStore.setState({ snapshots: { ...snapshots, [snapshot.table.id]: snapshot }, missing: rest });
}

function forget(id: string): void {
  const { snapshots, history } = tablesStore.getState();
  const { [id]: _snapshot, ...keptSnapshots } = snapshots;
  const { [id]: _history, ...keptHistory } = history;
  tablesStore.setState({ snapshots: keptSnapshots, history: keptHistory });
}

export async function openTable(id: string): Promise<TableSnapshot | null> {
  const cached = tablesStore.getState().snapshots[id];
  if (cached) return cached;
  const running = pending.get(id);
  if (running) return running;
  const request = requireApi()
    .readTable(id)
    .then((snapshot) => {
      putSnapshot(snapshot);
      return snapshot;
    })
    .catch(() => {
      tablesStore.setState({ missing: { ...tablesStore.getState().missing, [id]: true } });
      return null;
    })
    .finally(() => pending.delete(id));
  pending.set(id, request);
  return request;
}

export async function loadTables(): Promise<DataTableSummary[]> {
  loadToken += 1;
  const token = loadToken;
  const api = requireApi();
  const summaries = await api.listTables();
  if (token !== loadToken) return summaries;
  tablesStore.setState({ summaries, missing: {} });
  const open = Object.keys(tablesStore.getState().snapshots);
  await Promise.all(
    open.map(async (id) => {
      if (!summaries.some((summary) => summary.id === id)) {
        forget(id);
        return;
      }
      const snapshot = await api.readTable(id).catch(() => null);
      if (snapshot && token === loadToken) putSnapshot(snapshot);
    }),
  );
  return summaries;
}

export async function bootTables(api: TablesApi, hasProject: boolean): Promise<void> {
  tablesStore.setState({ api });
  if (hasProject) await loadTables();
  subscribeCurrentProject((project) => {
    loadToken += 1;
    tablesStore.setState({ summaries: null, snapshots: {}, missing: {}, history: {} });
    if (project) void loadTables();
  });
}

export function resetTablesStore(): void {
  pending.clear();
  tablesStore.setState({ api: null, summaries: null, snapshots: {}, missing: {}, history: {} });
}

export async function createTable(input: DataTableInput): Promise<TableSnapshot> {
  const snapshot = await requireApi().createTable(input);
  loadToken += 1;
  putSnapshot(snapshot);
  putSummary(snapshot.table, snapshot.rows.length);
  return snapshot;
}

export async function duplicateTable(id: string, name: string): Promise<TableSnapshot> {
  const snapshot = await requireApi().duplicateTable(id, name);
  loadToken += 1;
  putSnapshot(snapshot);
  putSummary(snapshot.table, snapshot.rows.length);
  return snapshot;
}

export async function deleteTable(id: string): Promise<DataTableSummary[]> {
  const summaries = await requireApi().deleteTable(id);
  loadToken += 1;
  forget(id);
  tablesStore.setState({ summaries });
  return summaries;
}

function record(id: string, entry: Entry): void {
  const { history } = tablesStore.getState();
  const current = history[id] ?? EMPTY;
  tablesStore.setState({
    history: { ...history, [id]: { undo: [...current.undo, entry].slice(-HISTORY_LIMIT), redo: [] } },
  });
}

function pickPatch(table: DataTable, patch: DataTablePatch): DataTablePatch {
  const before: DataTablePatch = {};
  if (patch.name !== undefined) before.name = table.name;
  if (patch.folderId !== undefined) before.folderId = table.folderId;
  if (patch.keyName !== undefined) before.keyName = table.keyName;
  if (patch.columns !== undefined) before.columns = table.columns;
  return before;
}

async function applyTablePatch(id: string, patch: DataTablePatch): Promise<DataTable> {
  const table = await requireApi().updateTable(id, patch);
  loadToken += 1;
  putSummary(table);
  const snapshot = tablesStore.getState().snapshots[id];
  if (snapshot) putSnapshot({ ...snapshot, table });
  return table;
}

export async function updateTable(
  id: string,
  patch: DataTablePatch,
  options: { record?: boolean } = {},
): Promise<DataTable> {
  const current = tablesStore.getState().snapshots[id]?.table;
  const table = await applyTablePatch(id, patch);
  if (options.record && current) {
    record(id, {
      forward: { type: 'table', patch },
      backward: { type: 'table', patch: pickPatch(current, patch) },
    });
  }
  return table;
}

function mergeChanges(id: string, changes: RowChanges): void {
  const snapshot = tablesStore.getState().snapshots[id];
  if (!snapshot) return;
  const replaced = new Map(changes.rows.map((row) => [row.id, row]));
  const removed = new Set(changes.removed);
  const rows = [
    ...snapshot.rows.filter((row) => !replaced.has(row.id) && !removed.has(row.id)),
    ...changes.rows,
  ].sort(byPosition);
  putSnapshot({ ...snapshot, rows });
  const summary = tablesStore.getState().summaries?.find((item) => item.id === id);
  if (summary) putSummary(snapshot.table, rows.length);
}

async function applyRows(id: string, ops: RowOp[]): Promise<RowChanges> {
  const changes = await requireApi().patchTableRows(id, ops);
  loadToken += 1;
  mergeChanges(id, changes);
  return changes;
}

export async function editRows(id: string, ops: RowOp[]): Promise<RowChanges> {
  const snapshot = (await openTable(id)) ?? { rows: [] };
  const forward = ops.map((op) =>
    op.op === 'insert' && op.id === undefined ? { ...op, id: crypto.randomUUID() } : op,
  );
  const backward = inverseOps(snapshot.rows, forward);
  const changes = await applyRows(id, forward);
  record(id, { forward: { type: 'rows', ops: forward }, backward: { type: 'rows', ops: backward } });
  return changes;
}

function run(id: string, action: Action): Promise<unknown> {
  return action.type === 'rows' ? applyRows(id, action.ops) : applyTablePatch(id, action.patch);
}

export async function undoTable(id: string): Promise<void> {
  const history = tablesStore.getState().history[id];
  const entry = history?.undo.at(-1);
  if (!history || !entry) return;
  await run(id, entry.backward);
  const latest = tablesStore.getState().history;
  tablesStore.setState({
    history: { ...latest, [id]: { undo: history.undo.slice(0, -1), redo: [...history.redo, entry] } },
  });
}

export async function redoTable(id: string): Promise<void> {
  const history = tablesStore.getState().history[id];
  const entry = history?.redo.at(-1);
  if (!history || !entry) return;
  await run(id, entry.forward);
  const latest = tablesStore.getState().history;
  tablesStore.setState({
    history: { ...latest, [id]: { undo: [...history.undo, entry], redo: history.redo.slice(0, -1) } },
  });
}

function lookupFrom(state: Pick<TablesState, 'snapshots' | 'summaries'>): TableLookup {
  return {
    tableOf: (tableId) =>
      state.snapshots[tableId]?.table ?? state.summaries?.find((summary) => summary.id === tableId),
    rowsOf: (tableId) => state.snapshots[tableId]?.rows ?? [],
  };
}

export function tableLookup(): TableLookup {
  return lookupFrom(tablesStore.getState());
}

export function useTables(): DataTableSummary[] | null {
  return useStore(tablesStore, (state) => state.summaries);
}

export function useTableSnapshot(id: string | null): TableSnapshot | null {
  const snapshot = useStore(tablesStore, (state) => (id === null ? undefined : state.snapshots[id]));
  const missing = useStore(tablesStore, (state) => (id === null ? false : state.missing[id] === true));
  useEffect(() => {
    if (id !== null && !snapshot && !missing && tablesStore.getState().api) void openTable(id);
  }, [id, snapshot, missing]);
  return snapshot ?? null;
}

export function useTableMissing(id: string | null): boolean {
  return useStore(tablesStore, (state) => (id === null ? false : state.missing[id] === true));
}

export function useTableLookup(tableIds: readonly string[]): TableLookup {
  const snapshots = useStore(tablesStore, (state) => state.snapshots);
  const summaries = useStore(tablesStore, (state) => state.summaries);
  const wanted = tableIds.join('|');
  useEffect(() => {
    if (!tablesStore.getState().api) return;
    for (const tableId of wanted.split('|')) if (tableId !== '') void openTable(tableId);
  }, [wanted]);
  return useMemo(() => lookupFrom({ snapshots, summaries }), [snapshots, summaries]);
}

export function useTableHistory(id: string | null): { canUndo: boolean; canRedo: boolean } {
  const canUndo = useStore(tablesStore, (state) =>
    id === null ? false : (state.history[id]?.undo.length ?? 0) > 0,
  );
  const canRedo = useStore(tablesStore, (state) =>
    id === null ? false : (state.history[id]?.redo.length ?? 0) > 0,
  );
  return useMemo(() => ({ canUndo, canRedo }), [canUndo, canRedo]);
}
