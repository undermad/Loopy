import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IpcChannel } from '@shared/ipc';
import type { DataTable, DataTableSummary, RowChanges, TableSnapshot } from '@shared/tables';
import { registerTablesHandlers } from '../../../src/main/ipc/tables';
import { createProject, type ProjectDatabase } from '../../../src/main/storage';
import { createFolder, deleteFolder } from '../../../src/main/storage/assets-repository';
import { createNote, listNotes } from '../../../src/main/storage/notes-repository';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

let directory: string;
let project: ProjectDatabase;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-tables-'));
  project = await createProject(join(directory, 'demo.loopy'), 'Demo');
});

afterEach(async () => {
  project.close();
  await rm(directory, { recursive: true, force: true });
});

function setup(open = true) {
  const handlers = new Map<string, Handler>();
  const ipc = { handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler)) };
  registerTablesHandlers(ipc, { project: () => (open ? project : null) });
  return <T>(channel: string, ...args: unknown[]) =>
    Promise.resolve().then(() => handlers.get(channel)?.({}, ...args)) as Promise<T>;
}

function folder(scope: 'tables' | 'cards', name: string): string {
  const snapshot = createFolder(project.db, { name, scope, parentId: null });
  const created = snapshot.folders.find((item) => item.name === name && item.scope === scope);
  if (!created) throw new Error('folder not created');
  return created.id;
}

async function items(call: ReturnType<typeof setup>): Promise<TableSnapshot> {
  return call<TableSnapshot>(IpcChannel.tablesCreate, {
    name: 'Items',
    columns: [
      { id: 'name', label: 'Name', kind: 'text' },
      { id: 'damage', label: 'Damage', kind: 'number', integer: true },
    ],
    rows: [
      { key: 'sword', cells: { name: 'Sword', damage: 4 } },
      { key: 'bow', cells: { name: 'Bow', damage: 3 } },
    ],
  });
}

describe('tables IPC handlers', () => {
  it('creates a table with rows in the given order and lists it with a row count', async () => {
    const call = setup();
    await expect(call(IpcChannel.tablesList)).resolves.toEqual([]);

    const snapshot = await items(call);

    expect(snapshot.table).toMatchObject({ name: 'Items', keyName: 'id', folderId: null });
    expect(snapshot.table.columns.map((column) => column.id)).toEqual(['name', 'damage']);
    expect(snapshot.rows.map((row) => [row.key, row.cells])).toEqual([
      ['sword', { name: 'Sword', damage: 4 }],
      ['bow', { name: 'Bow', damage: 3 }],
    ]);
    const list = await call<DataTableSummary[]>(IpcChannel.tablesList);
    expect(list).toEqual([{ ...snapshot.table, rowCount: 2 }]);
    await expect(call(IpcChannel.tablesRead, snapshot.table.id)).resolves.toEqual(snapshot);
  });

  it('renames, moves between table folders and changes columns', async () => {
    const call = setup();
    const { table } = await items(call);
    const enemies = folder('tables', 'Enemies');

    const updated = await call<DataTable>(IpcChannel.tablesUpdate, table.id, {
      name: 'Weapons',
      folderId: enemies,
      keyName: 'key',
      columns: [{ id: 'damage', label: 'Damage', kind: 'number' }],
    });

    expect(updated).toMatchObject({ name: 'Weapons', folderId: enemies, keyName: 'key' });
    expect(updated.columns).toHaveLength(1);
    const read = await call<TableSnapshot>(IpcChannel.tablesRead, table.id);
    expect(read.rows[0]?.cells).toEqual({ name: 'Sword', damage: 4 });
  });

  it('refuses folders of another scope, unknown tables and duplicate keys', async () => {
    const call = setup();
    const cards = folder('cards', 'Heroes');
    await expect(call(IpcChannel.tablesCreate, { name: 'X', folderId: cards })).rejects.toThrow(
      /does not hold tables/,
    );
    await expect(call(IpcChannel.tablesUpdate, 'missing', { name: 'Y' })).rejects.toThrow(/Unknown table/);
    await expect(call(IpcChannel.tablesRead, 'missing')).rejects.toThrow(/Unknown table/);
    await expect(
      call(IpcChannel.tablesCreate, { name: 'Dupes', rows: [{ key: 'a' }, { key: 'a' }] }),
    ).rejects.toThrow(/Duplicate key a/);
    await expect(call(IpcChannel.tablesList)).resolves.toEqual([]);
  });

  it('inserts, updates, moves and deletes rows in one transaction', async () => {
    const call = setup();
    const { table, rows } = await items(call);
    const [sword, bow] = rows;
    if (!sword || !bow) throw new Error('rows missing');

    const changes = await call<RowChanges>(IpcChannel.tablesPatchRows, table.id, [
      { op: 'insert', key: 'axe', cells: { name: 'Axe' }, after: sword.id },
      { op: 'update', id: sword.id, key: 'blade', cells: { damage: 5 } },
      { op: 'move', id: bow.id, after: null },
    ]);

    expect(changes.removed).toEqual([]);
    expect(changes.rows.map((row) => row.key).sort()).toEqual(['axe', 'blade', 'bow']);
    const read = await call<TableSnapshot>(IpcChannel.tablesRead, table.id);
    expect(read.rows.map((row) => row.key)).toEqual(['bow', 'blade', 'axe']);
    expect(read.rows[1]?.cells).toEqual({ name: 'Sword', damage: 5 });

    const removed = await call<RowChanges>(IpcChannel.tablesPatchRows, table.id, [
      { op: 'delete', id: bow.id },
    ]);
    expect(removed).toEqual({ rows: [], removed: [bow.id] });
  });

  it('clears a cell set to null and keeps an inserted row id for undo', async () => {
    const call = setup();
    const { table, rows } = await items(call);
    const sword = rows[0];
    if (!sword) throw new Error('row missing');

    await call(IpcChannel.tablesPatchRows, table.id, [{ op: 'update', id: sword.id, cells: { name: null } }]);
    await call(IpcChannel.tablesPatchRows, table.id, [{ op: 'delete', id: sword.id }]);
    const restored = await call<RowChanges>(IpcChannel.tablesPatchRows, table.id, [
      { op: 'insert', id: sword.id, key: 'sword', cells: { damage: 4 }, after: null },
    ]);

    expect(restored.rows[0]).toMatchObject({ id: sword.id, key: 'sword', cells: { damage: 4 } });
  });

  it('rolls back every operation when one fails', async () => {
    const call = setup();
    const { table, rows } = await items(call);
    const sword = rows[0];
    if (!sword) throw new Error('row missing');

    await expect(
      call(IpcChannel.tablesPatchRows, table.id, [
        { op: 'update', id: sword.id, cells: { damage: 99 } },
        { op: 'insert', key: 'bow' },
      ]),
    ).rejects.toThrow(/Duplicate key bow/);
    await expect(
      call(IpcChannel.tablesPatchRows, table.id, [{ op: 'update', id: 'missing', cells: {} }]),
    ).rejects.toThrow(/Unknown row/);

    const read = await call<TableSnapshot>(IpcChannel.tablesRead, table.id);
    expect(read.rows[0]?.cells['damage']).toBe(4);
    expect(read.rows).toHaveLength(2);
  });

  it('duplicates a table with its rows under a new name', async () => {
    const call = setup();
    const { table } = await items(call);

    const copy = await call<TableSnapshot>(IpcChannel.tablesDuplicate, table.id, 'Items copy');

    expect(copy.table.id).not.toBe(table.id);
    expect(copy.table.name).toBe('Items copy');
    expect(copy.rows.map((row) => row.key)).toEqual(['sword', 'bow']);
  });

  it('deletes a table and its rows, and a deleted folder moves its tables to the parent', async () => {
    const call = setup();
    const enemies = folder('tables', 'Enemies');
    const { table } = await call<TableSnapshot>(IpcChannel.tablesCreate, { name: 'Bats', folderId: enemies });
    deleteFolder(project.db, enemies);
    await expect(call<TableSnapshot>(IpcChannel.tablesRead, table.id)).resolves.toMatchObject({
      table: { folderId: null },
    });

    await expect(call(IpcChannel.tablesDelete, table.id)).resolves.toEqual([]);
    expect(project.db.prepare('SELECT COUNT(*) AS count FROM data_rows').get()).toEqual({ count: 0 });
  });

  it('rewrites note links when a table is renamed', async () => {
    const call = setup();
    const { table } = await items(call);
    createNote(project.db, { title: 'Balance', body: 'See [[table:Items]] for numbers.' });

    await call(IpcChannel.tablesUpdate, table.id, { name: 'Weapons' });

    expect(listNotes(project.db)[0]?.body).toBe('See [[table:Weapons]] for numbers.');
  });

  it('fails without an open project', async () => {
    const call = setup(false);
    await expect(call(IpcChannel.tablesList)).rejects.toThrow(/No project is open/);
  });
});
