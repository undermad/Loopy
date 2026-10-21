import { describe, expect, it } from 'vitest';
import {
  TABLE_EXPORT_FORMATS,
  dataTableSchema,
  exportTable,
  importTable,
  importFormatOf,
  tableFileName,
  tableNameFromFile,
  type DataTable,
  type TableColumnInput,
  type TableRow,
} from '@shared/tables';

const STAMP = '2026-10-21T00:00:00.000Z';

function table(id: string, name: string, columns: TableColumnInput[]): DataTable {
  return dataTableSchema.parse({
    id,
    folderId: null,
    name,
    keyName: 'id',
    columns,
    createdAt: STAMP,
    updatedAt: STAMP,
  });
}

function row(id: string, key: string, cells: TableRow['cells']): TableRow {
  return { id, key, position: id, cells, updatedAt: STAMP };
}

const owners = table('owners', 'Owners', [{ id: 'name', kind: 'text' }]);
const ownerRows = [row('o1', 'knight', { name: 'Knight' })];
const lookup = {
  tableOf: (id: string) => (id === 'owners' ? owners : undefined),
  rowsOf: (id: string) => (id === 'owners' ? ownerRows : []),
};

const items = table('items', 'Items', [
  { id: 'name', label: 'Name', kind: 'text', required: true },
  { id: 'damage', label: 'Damage', kind: 'number', integer: true, min: 0 },
  { id: 'rare', label: 'Rare', kind: 'checkbox' },
  { id: 'tags', label: 'Tags', kind: 'choice', options: ['fire', 'ice'], multiple: true },
  { id: 'owner', label: 'Owner', kind: 'reference', tableId: 'owners' },
  { id: 'double', label: 'Double', kind: 'formula', expression: 'damage * 2' },
]);
const rows = [
  row('r1', 'sword', {
    name: 'Iron, "old" sword',
    damage: 4,
    rare: true,
    tags: ['fire', 'ice'],
    owner: 'o1',
  }),
  row('r2', 'bow', { name: 'Bow|long', damage: 3 }),
];
const snapshot = { table: items, rows };

describe('exportTable', () => {
  it('lists the formats', () => {
    expect(TABLE_EXPORT_FORMATS).toEqual([
      'csv',
      'tsv',
      'json',
      'jsonKeyed',
      'markdown',
      'jsonSchema',
      'loopy',
    ]);
  });

  it('writes CSV and TSV with column ids, keys for references and computed formulas', () => {
    const csv = exportTable(snapshot, 'csv', { lookup });
    expect(csv).toMatchObject({ extension: 'csv', mime: 'text/csv' });
    expect(csv.text).toBe(
      'id,name,damage,rare,tags,owner,double\r\nsword,"Iron, ""old"" sword",4,true,"fire, ice",knight,8\r\nbow,Bow|long,3,false,,,6',
    );
    expect(exportTable(snapshot, 'tsv', { lookup }).text.split('\r\n')[0]).toBe(
      'id\tname\tdamage\trare\ttags\towner\tdouble',
    );
  });

  it('writes JSON as an array or keyed by the key with typed values', () => {
    const array = JSON.parse(exportTable(snapshot, 'json', { lookup }).text) as unknown;
    expect(array).toEqual([
      {
        id: 'sword',
        name: 'Iron, "old" sword',
        damage: 4,
        rare: true,
        tags: ['fire', 'ice'],
        owner: 'knight',
        double: 8,
      },
      { id: 'bow', name: 'Bow|long', damage: 3, rare: false, tags: [], owner: null, double: 6 },
    ]);
    const keyed = JSON.parse(exportTable(snapshot, 'jsonKeyed', { lookup }).text) as Record<string, unknown>;
    expect(Object.keys(keyed)).toEqual(['sword', 'bow']);
    expect(keyed['bow']).toEqual({
      name: 'Bow|long',
      damage: 3,
      rare: false,
      tags: [],
      owner: null,
      double: 6,
    });
  });

  it('writes a Markdown table with labels and escaped pipes', () => {
    expect(exportTable(snapshot, 'markdown', { lookup }).text.split('\n').slice(0, 3)).toEqual([
      '| id | Name | Damage | Rare | Tags | Owner | Double |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      '| sword | Iron, "old" sword | 4 | true | fire, ice | knight | 8 |',
    ]);
    expect(exportTable(snapshot, 'markdown', { lookup }).text).toContain('Bow\\|long');
  });

  it('describes a row with a JSON Schema', () => {
    const schema = JSON.parse(exportTable(snapshot, 'jsonSchema').text) as {
      title: string;
      type: string;
      items: { required: string[]; properties: Record<string, unknown> };
    };
    expect(schema.title).toBe('Items');
    expect(schema.type).toBe('array');
    expect(schema.items.required).toEqual(['id', 'name']);
    expect(schema.items.properties).toMatchObject({
      id: { type: 'string' },
      name: { type: 'string' },
      damage: { type: ['integer', 'null'], minimum: 0 },
      rare: { type: 'boolean' },
      tags: { type: 'array', items: { enum: ['fire', 'ice'] } },
      owner: { type: ['string', 'null'] },
      double: { type: ['number', 'null'], readOnly: true },
    });
  });

  it('round-trips through the Loopy exchange file', () => {
    const file = exportTable(snapshot, 'loopy', { app: '0.1.0' });
    expect(file.extension).toBe('loopy-table.json');
    const input = importTable(file.text, 'loopy', 'ignored');
    expect(input).toMatchObject({ name: 'Items', keyName: 'id' });
    expect(input.columns).toEqual(items.columns);
    expect(input.rows).toEqual(rows.map((item) => ({ key: item.key, cells: item.cells })));
  });
});

describe('importTable', () => {
  it('picks the format from the file name', () => {
    expect(importFormatOf('Items.csv')).toBe('csv');
    expect(importFormatOf('items.TSV')).toBe('tsv');
    expect(importFormatOf('items.txt')).toBe('tsv');
    expect(importFormatOf('Items.loopy-table.json')).toBe('loopy');
    expect(importFormatOf('items.json')).toBe('json');
    expect(importFormatOf('items.xlsx')).toBeNull();
  });

  it('reads CSV, finds the key column and guesses column kinds', () => {
    const csv = [
      'Name,ID,Damage,Weight,Rare,Colour,Released,Element',
      'Sword,sword,4,1.5,yes,#ff0000,2026-01-02,fire',
      'Bow,bow,3,0.5,no,#00ff00,2026-02-03,ice',
      'Axe,axe,6,2,no,#0000ff,2026-03-04,fire',
      'Staff,staff,2,1,yes,#ffffff,2026-04-05,ice',
    ].join('\n');

    const input = importTable(csv, 'csv', 'Weapons');

    expect(input.name).toBe('Weapons');
    expect(input.keyName).toBe('id');
    expect(input.columns.map((column) => [column.id, column.kind])).toEqual([
      ['name', 'text'],
      ['damage', 'number'],
      ['weight', 'number'],
      ['rare', 'checkbox'],
      ['colour', 'colour'],
      ['released', 'date'],
      ['element', 'choice'],
    ]);
    expect(input.columns[1]).toMatchObject({ label: 'Damage', integer: true });
    expect(input.columns[2]).toMatchObject({ integer: false });
    expect(input.columns[6]).toMatchObject({ options: [{ value: 'fire' }, { value: 'ice' }] });
    expect(input.rows[0]).toEqual({
      key: 'sword',
      cells: {
        name: 'Sword',
        damage: 4,
        weight: 1.5,
        rare: true,
        colour: '#ff0000',
        released: '2026-01-02',
        element: 'fire',
      },
    });
  });

  it('uses the first column as the key when none is named and fixes blank or repeated keys', () => {
    const input = importTable('Name\tHP\nBat\t3\n\t4\nBat\t5', 'tsv', 'Enemies');
    expect(input.keyName).toBe('name');
    expect(input.columns.map((column) => column.id)).toEqual(['hp']);
    expect(input.rows.map((item) => item.key)).toEqual(['Bat', 'row_1', 'Bat_2']);
  });

  it('reads a JSON array or an object keyed by id', () => {
    const array = importTable(
      JSON.stringify([
        { key: 'a', hp: 1, alive: true, tags: ['x', 'y'], meta: { level: 2 } },
        { key: 'b', hp: 2.5, alive: false },
      ]),
      'json',
      'Units',
    );
    expect(array.keyName).toBe('key');
    expect(array.columns.map((column) => [column.id, column.kind])).toEqual([
      ['hp', 'number'],
      ['alive', 'checkbox'],
      ['tags', 'text'],
      ['meta', 'text'],
    ]);
    expect(array.rows[0]?.cells).toEqual({ hp: 1, alive: true, tags: 'x, y', meta: '{"level":2}' });

    const keyed = importTable(JSON.stringify({ goblin: { hp: 3 }, orc: { hp: 9 } }), 'json', 'Units');
    expect(keyed.keyName).toBe('id');
    expect(keyed.rows).toEqual([
      { key: 'goblin', cells: { hp: 3 } },
      { key: 'orc', cells: { hp: 9 } },
    ]);
  });

  it('names files safely and tables after their file', () => {
    expect(tableFileName('a\\b/c:d*?')).toBe('a_b_c_d__');
    expect(tableFileName('  ')).toBe('table');
    expect(tableNameFromFile('C:\\games\\Items.loopy-table.json')).toBe('Items');
    expect(tableNameFromFile('/home/me/Bats.csv')).toBe('Bats');
    expect(tableNameFromFile('.csv')).toBe('Imported table');
  });

  it('refuses files it cannot read', () => {
    expect(() => importTable('not json', 'json', 'X')).toThrow(/Not a table file/);
    expect(() => importTable('"just a string"', 'json', 'X')).toThrow(/Not a table file/);
    expect(() =>
      importTable('{"loopy":{"kind":"theme","schemaVersion":1,"app":"x"},"data":{}}', 'loopy', 'X'),
    ).toThrow(/Not a table file/);
    expect(() => importTable('', 'csv', 'X')).toThrow(/Not a table file/);
  });
});
