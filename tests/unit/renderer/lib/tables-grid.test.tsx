import { describe, expect, it } from 'vitest';
import { dataTableSchema, type DataTable, type TableColumnInput, type TableRow } from '@shared/tables';
import {
  copyMatrix,
  fillDownOps,
  filterRows,
  inverseOps,
  nextRowKey,
  pasteOps,
  sortRows,
  visibleRange,
} from '@renderer/lib/tables';

const STAMP = '2026-10-21T00:00:00.000Z';

function table(columns: TableColumnInput[]): DataTable {
  return dataTableSchema.parse({
    id: 't1',
    folderId: null,
    name: 'Items',
    keyName: 'id',
    columns,
    createdAt: STAMP,
    updatedAt: STAMP,
  });
}

function row(id: string, key: string, cells: TableRow['cells'] = {}, position = id): TableRow {
  return { id, key, position, cells, updatedAt: STAMP };
}

const items = table([
  { id: 'name', kind: 'text' },
  { id: 'damage', kind: 'number' },
  { id: 'rare', kind: 'checkbox' },
]);
const rows = [
  row('r1', 'sword', { name: 'Sword', damage: 4 }),
  row('r2', 'bow', { name: 'Bow', damage: 10, rare: true }),
  row('r3', 'axe', { name: 'Axe' }),
];

describe('visibleRange', () => {
  it('covers the rows in view plus overscan, clamped to the table', () => {
    expect(visibleRange({ scrollTop: 0, height: 100, rowHeight: 20, count: 1000, overscan: 2 })).toEqual({
      start: 0,
      end: 7,
    });
    expect(visibleRange({ scrollTop: 400, height: 100, rowHeight: 20, count: 1000, overscan: 2 })).toEqual({
      start: 18,
      end: 27,
    });
    expect(visibleRange({ scrollTop: 0, height: 100, rowHeight: 20, count: 3, overscan: 2 })).toEqual({
      start: 0,
      end: 3,
    });
  });
});

describe('sortRows and filterRows', () => {
  it('sorts by the key or a column, numbers as numbers and empties last', () => {
    expect(sortRows(rows, { columnId: null, direction: 'asc' }, items).map((item) => item.key)).toEqual([
      'axe',
      'bow',
      'sword',
    ]);
    expect(sortRows(rows, { columnId: 'damage', direction: 'asc' }, items).map((item) => item.key)).toEqual([
      'sword',
      'bow',
      'axe',
    ]);
    expect(sortRows(rows, { columnId: 'damage', direction: 'desc' }, items).map((item) => item.key)).toEqual([
      'bow',
      'sword',
      'axe',
    ]);
    expect(sortRows(rows, null, items)).toBe(rows);
  });

  it('keeps rows whose key or any shown value contains every word', () => {
    expect(filterRows(rows, 'bo', items).map((item) => item.key)).toEqual(['bow']);
    expect(filterRows(rows, 'sword 4', items).map((item) => item.key)).toEqual(['sword']);
    expect(filterRows(rows, '  ', items)).toBe(rows);
  });
});

describe('nextRowKey', () => {
  it('numbers new keys past the existing ones', () => {
    expect(nextRowKey([])).toBe('row_1');
    expect(nextRowKey([row('a', 'row_1'), row('b', 'row_3')])).toBe('row_4');
    expect(nextRowKey([row('a', 'item_2')], 'item')).toBe('item_3');
  });
});

describe('clipboard', () => {
  it('copies a range with the key as the first column', () => {
    expect(copyMatrix(items, rows, { top: 0, left: 0, bottom: 1, right: 3 })).toEqual([
      ['sword', 'Sword', '4', 'false'],
      ['bow', 'Bow', '10', 'true'],
    ]);
  });

  it('pastes into existing rows and appends rows past the end', () => {
    const result = pasteOps(items, rows, { row: 2, column: 1 }, [
      ['Hatchet', '6'],
      ['Club', 'x'],
    ]);
    expect(result.errors).toEqual([{ row: 3, column: 2, error: 'number' }]);
    expect(result.ops).toEqual([
      { op: 'update', id: 'r3', cells: { name: 'Hatchet', damage: 6 } },
      { op: 'insert', key: 'row_1', cells: { name: 'Club' } },
    ]);
  });

  it('uses pasted keys and refuses keys already taken', () => {
    const result = pasteOps(items, rows, { row: 3, column: 0 }, [
      ['mace', 'Mace'],
      ['bow', 'Bow 2'],
      ['', 'Blank'],
    ]);
    expect(result.ops).toEqual([
      { op: 'insert', key: 'mace', cells: { name: 'Mace' } },
      { op: 'insert', key: 'row_1', cells: { name: 'Blank' } },
    ]);
    expect(result.errors).toEqual([{ row: 4, column: 0, error: 'key' }]);
  });

  it('renames a key in place when the paste covers the key column', () => {
    expect(pasteOps(items, rows, { row: 0, column: 0 }, [['blade']]).ops).toEqual([
      { op: 'update', id: 'r1', key: 'blade' },
    ]);
  });

  it('fills a column down from the first row of the range', () => {
    expect(fillDownOps(items, rows, { top: 0, left: 1, bottom: 2, right: 2 })).toEqual([
      { op: 'update', id: 'r2', cells: { name: 'Sword', damage: 4 } },
      { op: 'update', id: 'r3', cells: { name: 'Sword', damage: 4 } },
    ]);
  });
});

describe('inverseOps', () => {
  it('undoes each kind of operation in reverse order', () => {
    const ordered = [
      row('r1', 'sword', { damage: 4 }, 'a'),
      row('r2', 'bow', {}, 'b'),
      row('r3', 'axe', {}, 'c'),
    ];
    expect(
      inverseOps(ordered, [
        { op: 'insert', id: 'n1', key: 'mace' },
        { op: 'update', id: 'r1', key: 'blade', cells: { damage: 9, name: 'Blade' } },
        { op: 'move', id: 'r3', after: null },
        { op: 'delete', id: 'r2' },
      ]),
    ).toEqual([
      { op: 'insert', id: 'r2', key: 'bow', cells: {}, after: 'r1' },
      { op: 'move', id: 'r3', after: 'r2' },
      { op: 'update', id: 'r1', key: 'sword', cells: { damage: 4, name: null } },
      { op: 'delete', id: 'n1' },
    ]);
  });
});
