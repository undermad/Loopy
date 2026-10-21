import { describe, expect, it } from 'vitest';
import {
  TABLE_COLUMN_KINDS,
  columnIdFrom,
  dataTableInputSchema,
  rowOpSchema,
  tableCellSchema,
  tableColumnSchema,
} from '@shared/tables';

describe('table columns', () => {
  it('lists the column kinds in picker order', () => {
    expect(TABLE_COLUMN_KINDS).toEqual([
      'text',
      'number',
      'checkbox',
      'choice',
      'date',
      'colour',
      'image',
      'link',
      'reference',
      'formula',
      'dice',
    ]);
  });

  it('fills the defaults each kind needs', () => {
    expect(tableColumnSchema.parse({ id: 'damage', kind: 'number' })).toMatchObject({
      id: 'damage',
      label: '',
      kind: 'number',
      width: 140,
      required: false,
      unique: false,
      description: '',
      integer: false,
      min: null,
      max: null,
      defaultValue: null,
    });
    expect(tableColumnSchema.parse({ id: 'rarity', kind: 'choice', options: ['common'] })).toMatchObject({
      options: [{ value: 'common', colour: null }],
      multiple: false,
    });
    expect(tableColumnSchema.parse({ id: 'owner', kind: 'reference' })).toMatchObject({
      tableId: null,
      multiple: false,
    });
    expect(tableColumnSchema.parse({ id: 'dps', kind: 'formula' })).toMatchObject({
      expression: '',
      decimals: null,
    });
  });

  it('drops keys a kind does not use', () => {
    const column = tableColumnSchema.parse({ id: 'name', kind: 'text', integer: true });
    expect(column).not.toHaveProperty('integer');
  });

  it('rejects column ids that exports could not use', () => {
    expect(() => tableColumnSchema.parse({ id: 'Max HP', kind: 'text' })).toThrow();
    expect(() => tableColumnSchema.parse({ id: '1st', kind: 'text' })).toThrow();
    expect(tableColumnSchema.parse({ id: 'max_hp', kind: 'text' }).id).toBe('max_hp');
  });

  it('makes a unique id from a label', () => {
    expect(columnIdFrom('Max HP', [])).toBe('max_hp');
    expect(columnIdFrom('Max HP', ['max_hp'])).toBe('max_hp_2');
    expect(columnIdFrom('Max HP', ['max_hp', 'max_hp_2'])).toBe('max_hp_3');
    expect(columnIdFrom('Café', [])).toBe('cafe');
    expect(columnIdFrom('123', [])).toBe('c_123');
    expect(columnIdFrom('!!!', [])).toBe('column');
    expect(columnIdFrom('id', [], ['id'])).toBe('id_2');
  });
});

describe('tables', () => {
  it('rejects duplicate column ids and a column named like the key', () => {
    expect(() =>
      dataTableInputSchema.parse({
        name: 'Items',
        columns: [
          { id: 'a', kind: 'text' },
          { id: 'a', kind: 'number' },
        ],
      }),
    ).toThrow();
    expect(() =>
      dataTableInputSchema.parse({ name: 'Items', keyName: 'id', columns: [{ id: 'id', kind: 'text' }] }),
    ).toThrow();
  });

  it('defaults the key name, folder, columns and rows', () => {
    expect(dataTableInputSchema.parse({ name: ' Items ' })).toEqual({
      name: 'Items',
      folderId: null,
      keyName: 'id',
      columns: [],
      rows: [],
    });
  });

  it('accepts the cell shapes columns store', () => {
    for (const value of ['text', 3, true, ['a', 'b'], { kind: 'board', id: 'b1' }, null]) {
      expect(tableCellSchema.parse(value)).toEqual(value);
    }
    expect(() => tableCellSchema.parse({ nope: 1 })).toThrow();
  });

  it('parses each row operation', () => {
    expect(rowOpSchema.parse({ op: 'insert', key: 'sword' })).toEqual({
      op: 'insert',
      key: 'sword',
      cells: {},
    });
    expect(rowOpSchema.parse({ op: 'update', id: 'r1', cells: { damage: 4 } }).op).toBe('update');
    expect(rowOpSchema.parse({ op: 'move', id: 'r1', after: null }).op).toBe('move');
    expect(rowOpSchema.parse({ op: 'delete', id: 'r1' }).op).toBe('delete');
    expect(() => rowOpSchema.parse({ op: 'insert', key: '  ' })).toThrow();
  });
});
