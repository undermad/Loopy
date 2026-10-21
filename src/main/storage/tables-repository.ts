import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { keyBetween } from '@shared/ordering';
import {
  dataTableInputSchema,
  dataTablePatchSchema,
  dataTableSchema,
  dataTableSummaryListSchema,
  rowOpsSchema,
  tableNameSchema,
  tableRowSchema,
  tableSnapshotSchema,
  type DataTable,
  type DataTableSummary,
  type RowChanges,
  type TableCells,
  type TableRow,
  type TableSnapshot,
} from '@shared/tables';
import { assertFolderScope } from './assets-repository';
import { transaction } from './tickets-repository';

const TABLE_COLUMNS =
  'id, folder_id AS folderId, name, key_name AS keyName, columns, created_at AS createdAt, updated_at AS updatedAt';
const ROW_COLUMNS = 'id, key, position, cells, updated_at AS updatedAt';

interface TableRecord {
  id: string;
  folderId: string | null;
  name: string;
  keyName: string;
  columns: string;
  createdAt: string;
  updatedAt: string;
}

interface RowRecord {
  id: string;
  key: string;
  position: string;
  cells: string;
  updatedAt: string;
}

function now(): string {
  return new Date().toISOString();
}

function toTable(record: TableRecord): DataTable {
  return dataTableSchema.parse({ ...record, columns: JSON.parse(record.columns) as unknown });
}

function toRow(record: RowRecord): TableRow {
  return tableRowSchema.parse({ ...record, cells: JSON.parse(record.cells) as unknown });
}

function readTable(db: DatabaseSync, id: string): DataTable {
  const record = db.prepare(`SELECT ${TABLE_COLUMNS} FROM data_tables WHERE id = ?`).get(id) as
    TableRecord | undefined;
  if (!record) throw new Error(`Unknown table ${id}`);
  return toTable(record);
}

function readRow(db: DatabaseSync, tableId: string, id: string): TableRow {
  const record = db
    .prepare(`SELECT ${ROW_COLUMNS} FROM data_rows WHERE id = ? AND table_id = ?`)
    .get(id, tableId) as RowRecord | undefined;
  if (!record) throw new Error(`Unknown row ${id}`);
  return toRow(record);
}

function readRows(db: DatabaseSync, tableId: string): TableRow[] {
  const records = db
    .prepare(`SELECT ${ROW_COLUMNS} FROM data_rows WHERE table_id = ? ORDER BY position, id`)
    .all(tableId) as unknown as RowRecord[];
  return records.map(toRow);
}

function lastPosition(db: DatabaseSync, tableId: string): string | null {
  const record = db
    .prepare('SELECT MAX(position) AS position FROM data_rows WHERE table_id = ?')
    .get(tableId) as {
    position: string | null;
  };
  return record.position;
}

function positionAfter(db: DatabaseSync, tableId: string, after: string | null, skip?: string): string {
  const exclude = skip ?? '';
  if (after === null) {
    const first = db
      .prepare('SELECT position FROM data_rows WHERE table_id = ? AND id != ? ORDER BY position LIMIT 1')
      .get(tableId, exclude) as { position: string } | undefined;
    return keyBetween(null, first?.position ?? null);
  }
  const anchor = readRow(db, tableId, after);
  const next = db
    .prepare(
      'SELECT position FROM data_rows WHERE table_id = ? AND position > ? AND id != ? ORDER BY position LIMIT 1',
    )
    .get(tableId, anchor.position, exclude) as { position: string } | undefined;
  return keyBetween(anchor.position, next?.position ?? null);
}

function isDuplicateKey(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('UNIQUE constraint failed: data_rows.table_id, data_rows.key')
  );
}

function withKeyCheck<T>(key: string, work: () => T): T {
  try {
    return work();
  } catch (error) {
    if (isDuplicateKey(error)) throw new Error(`Duplicate key ${key}`);
    throw error;
  }
}

function insertRow(
  db: DatabaseSync,
  tableId: string,
  row: { id?: string | undefined; key: string; cells: TableCells },
  position: string,
): string {
  const id = row.id ?? randomUUID();
  const stamp = now();
  withKeyCheck(row.key, () =>
    db
      .prepare(
        'INSERT INTO data_rows (id, table_id, key, position, cells, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(id, tableId, row.key, position, JSON.stringify(row.cells), stamp, stamp),
  );
  return id;
}

function touch(db: DatabaseSync, tableId: string): void {
  db.prepare('UPDATE data_tables SET updated_at = ? WHERE id = ?').run(now(), tableId);
}

export function listTables(db: DatabaseSync): DataTableSummary[] {
  const records = db
    .prepare(
      `SELECT ${TABLE_COLUMNS}, (SELECT COUNT(*) FROM data_rows r WHERE r.table_id = t.id) AS rowCount
       FROM data_tables t ORDER BY name COLLATE NOCASE, id`,
    )
    .all() as unknown as (TableRecord & { rowCount: number })[];
  return dataTableSummaryListSchema.parse(
    records.map((record) => ({ ...toTable(record), rowCount: record.rowCount })),
  );
}

export function readTableSnapshot(db: DatabaseSync, id: string): TableSnapshot {
  return tableSnapshotSchema.parse({ table: readTable(db, id), rows: readRows(db, id) });
}

export function createTable(db: DatabaseSync, raw: unknown): TableSnapshot {
  const input = dataTableInputSchema.parse(raw);
  assertFolderScope(db, input.folderId, 'tables');
  return transaction(db, () => {
    const id = randomUUID();
    const stamp = now();
    db.prepare(
      'INSERT INTO data_tables (id, folder_id, name, key_name, columns, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(id, input.folderId, input.name, input.keyName, JSON.stringify(input.columns), stamp, stamp);
    let position: string | null = null;
    for (const row of input.rows) {
      position = keyBetween(position, null);
      insertRow(db, id, row, position);
    }
    return readTableSnapshot(db, id);
  });
}

export function updateTable(db: DatabaseSync, id: string, raw: unknown): DataTable {
  const patch = dataTablePatchSchema.parse(raw);
  const current = readTable(db, id);
  const keyName = patch.keyName ?? current.keyName;
  const columns = patch.columns ?? current.columns;
  dataTablePatchSchema.parse({ keyName, columns });
  if (patch.folderId !== undefined) assertFolderScope(db, patch.folderId, 'tables');
  db.prepare(
    'UPDATE data_tables SET name = ?, folder_id = ?, key_name = ?, columns = ?, updated_at = ? WHERE id = ?',
  ).run(
    patch.name ?? current.name,
    patch.folderId === undefined ? current.folderId : patch.folderId,
    keyName,
    JSON.stringify(columns),
    now(),
    id,
  );
  return readTable(db, id);
}

export function duplicateTable(db: DatabaseSync, id: string, rawName: unknown): TableSnapshot {
  const name = tableNameSchema.parse(rawName);
  const { table, rows } = readTableSnapshot(db, id);
  return createTable(db, {
    name,
    folderId: table.folderId,
    keyName: table.keyName,
    columns: table.columns,
    rows: rows.map((row) => ({ key: row.key, cells: row.cells })),
  });
}

export function deleteTable(db: DatabaseSync, id: string): DataTableSummary[] {
  db.prepare('DELETE FROM data_tables WHERE id = ?').run(id);
  return listTables(db);
}

function mergeCells(current: TableCells, patch: TableCells): TableCells {
  return Object.fromEntries(Object.entries({ ...current, ...patch }).filter(([, value]) => value !== null));
}

export function patchRows(db: DatabaseSync, tableId: string, raw: unknown): RowChanges {
  const ops = rowOpsSchema.parse(raw);
  return transaction(db, () => {
    readTable(db, tableId);
    const touched = new Set<string>();
    const removed = new Set<string>();
    for (const op of ops) {
      if (op.op === 'insert') {
        const position =
          op.after === undefined
            ? keyBetween(lastPosition(db, tableId), null)
            : positionAfter(db, tableId, op.after);
        const id = insertRow(db, tableId, op, position);
        touched.add(id);
        removed.delete(id);
      } else if (op.op === 'update') {
        const row = readRow(db, tableId, op.id);
        const key = op.key ?? row.key;
        const cells = op.cells === undefined ? row.cells : mergeCells(row.cells, op.cells);
        withKeyCheck(key, () =>
          db
            .prepare('UPDATE data_rows SET key = ?, cells = ?, updated_at = ? WHERE id = ?')
            .run(key, JSON.stringify(cells), now(), op.id),
        );
        touched.add(op.id);
      } else if (op.op === 'move') {
        readRow(db, tableId, op.id);
        const position = positionAfter(db, tableId, op.after, op.id);
        db.prepare('UPDATE data_rows SET position = ?, updated_at = ? WHERE id = ?').run(
          position,
          now(),
          op.id,
        );
        touched.add(op.id);
      } else {
        db.prepare('DELETE FROM data_rows WHERE id = ? AND table_id = ?').run(op.id, tableId);
        touched.delete(op.id);
        removed.add(op.id);
      }
    }
    touch(db, tableId);
    return { rows: [...touched].map((id) => readRow(db, tableId, id)), removed: [...removed] };
  });
}
