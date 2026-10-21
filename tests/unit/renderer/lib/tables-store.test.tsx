import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { closeProject } from '@renderer/lib/project';
import {
  createTable,
  deleteTable,
  duplicateTable,
  editRows,
  loadTables,
  redoTable,
  tableLookup,
  undoTable,
  updateTable,
  useTableHistory,
  useTableSnapshot,
  useTables,
} from '@renderer/lib/tables';
import { bootTestApp, makeProject, type FakeApi } from '../helpers/api';

let api: FakeApi;

beforeEach(async () => {
  api = await bootTestApp();
  api.current = makeProject('Space Game');
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

async function items() {
  return act(() =>
    createTable({
      name: 'Items',
      columns: [{ id: 'damage', label: 'Damage', kind: 'number' }],
      rows: [
        { key: 'sword', cells: { damage: 4 } },
        { key: 'bow', cells: { damage: 3 } },
      ],
    }),
  );
}

describe('tables store', () => {
  it('lists, creates, renames, duplicates and deletes tables for the open project', async () => {
    const { result } = renderHook(() => useTables());
    await waitFor(() => {
      expect(result.current).toEqual([]);
    });

    const { table } = await items();
    expect(result.current?.map((item) => [item.name, item.rowCount])).toEqual([['Items', 2]]);

    await act(() => updateTable(table.id, { name: 'Weapons' }));
    expect(result.current?.[0]?.name).toBe('Weapons');

    const copy = await act(() => duplicateTable(table.id, 'Weapons copy'));
    expect(result.current?.map((item) => item.name)).toEqual(['Weapons', 'Weapons copy']);

    await act(() => deleteTable(copy.table.id));
    expect(result.current?.map((item) => item.name)).toEqual(['Weapons']);

    await act(async () => {
      await closeProject();
    });
    expect(result.current).toBeNull();
  });

  it('loads a snapshot on demand and merges row edits into it', async () => {
    const { table, rows } = await items();
    const { result } = renderHook(() => useTableSnapshot(table.id));
    await waitFor(() => {
      expect(result.current?.rows).toHaveLength(2);
    });

    await act(() =>
      editRows(table.id, [
        { op: 'update', id: rows[0]?.id ?? '', cells: { damage: 9 } },
        { op: 'insert', key: 'axe', cells: { damage: 5 } },
      ]),
    );
    expect(result.current?.rows.map((row) => [row.key, row.cells['damage']])).toEqual([
      ['sword', 9],
      ['bow', 3],
      ['axe', 5],
    ]);
    expect(tableLookup().rowsOf(table.id)).toHaveLength(3);
    expect(tableLookup().tableOf(table.id)?.name).toBe('Items');
  });

  it('undoes and redoes row edits, moves, deletions and column changes', async () => {
    const { table, rows } = await items();
    const [sword, bow] = rows;
    if (!sword || !bow) throw new Error('rows missing');
    const snapshot = renderHook(() => useTableSnapshot(table.id));
    const history = renderHook(() => useTableHistory(table.id));
    await waitFor(() => {
      expect(snapshot.result.current?.rows).toHaveLength(2);
    });
    const keys = () => snapshot.result.current?.rows.map((row) => row.key);

    await act(() => editRows(table.id, [{ op: 'update', id: sword.id, key: 'blade', cells: { damage: 7 } }]));
    await act(() => editRows(table.id, [{ op: 'move', id: bow.id, after: null }]));
    await act(() => editRows(table.id, [{ op: 'delete', id: sword.id }]));
    await act(() => updateTable(table.id, { columns: [] }, { record: true }));
    expect(keys()).toEqual(['bow']);
    expect(history.result.current).toEqual({ canUndo: true, canRedo: false });

    await act(() => undoTable(table.id));
    expect(snapshot.result.current?.table.columns).toHaveLength(1);
    await act(() => undoTable(table.id));
    expect(keys()).toEqual(['bow', 'blade']);
    await act(() => undoTable(table.id));
    expect(keys()).toEqual(['blade', 'bow']);
    await act(() => undoTable(table.id));
    expect(snapshot.result.current?.rows[0]).toMatchObject({ key: 'sword', cells: { damage: 4 } });
    expect(history.result.current).toEqual({ canUndo: false, canRedo: true });

    await act(() => redoTable(table.id));
    await act(() => redoTable(table.id));
    expect(keys()).toEqual(['bow', 'blade']);
    await act(() => undoTable(table.id));
    await act(() => editRows(table.id, [{ op: 'insert', key: 'axe' }]));
    expect(history.result.current.canRedo).toBe(false);
  });

  it('keeps the snapshot unchanged when the main process refuses an edit', async () => {
    const { table } = await items();
    const { result } = renderHook(() => useTableSnapshot(table.id));
    await waitFor(() => {
      expect(result.current?.rows).toHaveLength(2);
    });

    await expect(act(() => editRows(table.id, [{ op: 'insert', key: 'bow' }]))).rejects.toThrow(
      /Duplicate key/,
    );
    expect(result.current?.rows).toHaveLength(2);
  });

  it('reads a table once for several viewers and forgets it when it is deleted elsewhere', async () => {
    const { table } = await items();
    await act(async () => {
      await loadTables();
    });
    vi.mocked(api.readTable).mockClear();
    const first = renderHook(() => useTableSnapshot(table.id));
    const second = renderHook(() => useTableSnapshot(table.id));
    await waitFor(() => {
      expect(first.result.current?.rows).toHaveLength(2);
    });
    expect(second.result.current?.rows).toHaveLength(2);

    await api.deleteTable(table.id);
    await act(() => loadTables());

    expect(first.result.current).toBeNull();
    expect(tableLookup().rowsOf(table.id)).toEqual([]);
  });

  it('reloads open snapshots when another window changes tables', async () => {
    const { table } = await items();
    const { result } = renderHook(() => useTableSnapshot(table.id));
    await waitFor(() => {
      expect(result.current?.rows).toHaveLength(2);
    });

    await api.patchTableRows(table.id, [{ op: 'insert', key: 'axe' }]);
    await act(() => loadTables());

    expect(result.current?.rows).toHaveLength(3);
  });
});
