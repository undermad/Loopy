import { vi } from 'vitest';
import type { LoopyApi } from '@shared/ipc';
import { keyBetween } from '@shared/ordering';
import {
  dataTableInputSchema,
  dataTablePatchSchema,
  rowOpsSchema,
  type DataTable,
  type DataTableSummary,
  type RowChanges,
  type TableImportResult,
  type TableRow,
  type TableSnapshot,
} from '@shared/tables';

type TablesFakeApi = Pick<
  LoopyApi,
  | 'listTables'
  | 'readTable'
  | 'createTable'
  | 'updateTable'
  | 'duplicateTable'
  | 'deleteTable'
  | 'patchTableRows'
  | 'exportTable'
  | 'importTable'
>;

const STAMP = '2026-10-21T09:00:00.000Z';

export function createTablesFake() {
  const data = { tables: [] as DataTable[], rows: new Map<string, TableRow[]>(), counter: 0 };
  const nextId = (prefix: string) => {
    data.counter += 1;
    return `${prefix}-${String(data.counter)}`;
  };
  const ordered = (tableId: string) =>
    [...(data.rows.get(tableId) ?? [])].sort((a, b) => (a.position < b.position ? -1 : 1));
  const find = (id: string) => {
    const table = data.tables.find((item) => item.id === id);
    if (!table) throw new Error(`Unknown table ${id}`);
    return table;
  };
  const snapshot = (id: string): TableSnapshot => structuredClone({ table: find(id), rows: ordered(id) });
  const summaries = (): DataTableSummary[] =>
    structuredClone(
      [...data.tables]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((table) => ({ ...table, rowCount: data.rows.get(table.id)?.length ?? 0 })),
    );
  const create = (raw: unknown): TableSnapshot => {
    const input = dataTableInputSchema.parse(raw);
    const table: DataTable = {
      id: nextId('table'),
      folderId: input.folderId,
      name: input.name,
      keyName: input.keyName,
      columns: input.columns,
      createdAt: STAMP,
      updatedAt: STAMP,
    };
    let position: string | null = null;
    const rows: TableRow[] = [];
    for (const row of input.rows) {
      if (rows.some((item) => item.key === row.key)) throw new Error(`Duplicate key ${row.key}`);
      position = keyBetween(position, null);
      rows.push({ id: nextId('row'), key: row.key, position, cells: row.cells, updatedAt: STAMP });
    }
    data.tables.push(table);
    data.rows.set(table.id, rows);
    return snapshot(table.id);
  };
  const positionAfter = (tableId: string, after: string | null, skip?: string) => {
    const rows = ordered(tableId).filter((row) => row.id !== skip);
    if (after === null) return keyBetween(null, rows[0]?.position ?? null);
    const index = rows.findIndex((row) => row.id === after);
    const anchor = rows[index];
    if (!anchor) throw new Error(`Unknown row ${after}`);
    return keyBetween(anchor.position, rows[index + 1]?.position ?? null);
  };
  const patch = (tableId: string, raw: unknown): RowChanges => {
    find(tableId);
    const ops = rowOpsSchema.parse(raw);
    const backup = structuredClone(data.rows.get(tableId) ?? []);
    const touched = new Set<string>();
    const removed = new Set<string>();
    try {
      for (const op of ops) {
        const rows = data.rows.get(tableId) ?? [];
        const key = 'key' in op ? op.key : undefined;
        if (key !== undefined && rows.some((row) => row.key === key && row.id !== ('id' in op ? op.id : '')))
          throw new Error(`Duplicate key ${key}`);
        if (op.op === 'insert') {
          const position =
            op.after === undefined
              ? keyBetween(ordered(tableId).at(-1)?.position ?? null, null)
              : positionAfter(tableId, op.after);
          const id = op.id ?? nextId('row');
          rows.push({ id, key: op.key, position, cells: op.cells, updatedAt: STAMP });
          touched.add(id);
          removed.delete(id);
        } else if (op.op === 'delete') {
          data.rows.set(
            tableId,
            rows.filter((row) => row.id !== op.id),
          );
          touched.delete(op.id);
          removed.add(op.id);
        } else {
          const row = rows.find((item) => item.id === op.id);
          if (!row) throw new Error(`Unknown row ${op.id}`);
          if (op.op === 'move') row.position = positionAfter(tableId, op.after, op.id);
          else {
            row.key = op.key ?? row.key;
            row.cells = Object.fromEntries(
              Object.entries({ ...row.cells, ...op.cells }).filter(([, value]) => value !== null),
            );
          }
          touched.add(op.id);
        }
      }
    } catch (error) {
      data.rows.set(tableId, backup);
      throw error;
    }
    const rows = data.rows.get(tableId) ?? [];
    return structuredClone({
      rows: [...touched].map((id) => rows.find((row) => row.id === id)).filter((row) => row !== undefined),
      removed: [...removed],
    });
  };
  const api: TablesFakeApi = {
    listTables: vi.fn(() => Promise.resolve(summaries())),
    readTable: vi.fn((id: string) => Promise.resolve().then(() => snapshot(id))),
    createTable: vi.fn((raw: unknown) => Promise.resolve().then(() => create(raw))),
    updateTable: vi.fn((id: string, raw: unknown) =>
      Promise.resolve().then(() => {
        const current = find(id);
        const changes = dataTablePatchSchema.parse(raw);
        Object.assign(
          current,
          Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)),
        );
        return structuredClone(current);
      }),
    ),
    duplicateTable: vi.fn((id: string, name: string) =>
      Promise.resolve().then(() => {
        const { table, rows } = snapshot(id);
        return create({ ...table, name, rows: rows.map((row) => ({ key: row.key, cells: row.cells })) });
      }),
    ),
    deleteTable: vi.fn((id: string) => {
      data.tables = data.tables.filter((table) => table.id !== id);
      data.rows.delete(id);
      return Promise.resolve(summaries());
    }),
    patchTableRows: vi.fn((tableId: string, ops: unknown) =>
      Promise.resolve().then(() => patch(tableId, ops)),
    ),
    exportTable: vi.fn(() => Promise.resolve({ status: 'exported' as const })),
    importTable: vi.fn((): Promise<TableImportResult> => Promise.resolve({ status: 'cancelled' })),
  };
  return { data, api, create };
}
