import { describe, expect, it } from 'vitest';
import {
  computeTable,
  dataTableSchema,
  validateTable,
  type DataTable,
  type TableColumnInput,
  type TableRow,
} from '@shared/tables';

const STAMP = '2026-10-21T00:00:00.000Z';

function table(id: string, columns: TableColumnInput[]): DataTable {
  return dataTableSchema.parse({
    id,
    folderId: null,
    name: id,
    keyName: 'id',
    columns,
    createdAt: STAMP,
    updatedAt: STAMP,
  });
}

function row(id: string, key: string, cells: TableRow['cells'] = {}): TableRow {
  return { id, key, position: id, cells, updatedAt: STAMP };
}

const weapons = table('weapons', [
  { id: 'damage', kind: 'number' },
  { id: 'bonus', kind: 'formula', expression: 'damage * 2' },
]);
const weaponRows = [row('w1', 'sword', { damage: 4 }), row('w2', 'bow', { damage: 3 })];

const heroes = table('heroes', [
  { id: 'level', kind: 'number' },
  { id: 'brave', kind: 'checkbox' },
  { id: 'hit', kind: 'dice' },
  { id: 'weapon', kind: 'reference', tableId: 'weapons' },
  { id: 'power', kind: 'formula', expression: 'level * 10 + weapon.damage + weapon.bonus', decimals: 1 },
  { id: 'double', kind: 'formula', expression: 'power * 2' },
  { id: 'avg', kind: 'formula', expression: 'hit + brave', decimals: 0 },
]);

const refs = {
  tableOf: (id: string) => (id === 'weapons' ? weapons : undefined),
  rowsOf: (id: string) => (id === 'weapons' ? weaponRows : []),
};

describe('computeTable', () => {
  it('evaluates formulas over the row, other formulas and referenced rows', () => {
    const values = computeTable(
      heroes,
      [row('h1', 'knight', { level: 2, brave: true, hit: '2d6', weapon: 'w1' })],
      refs,
    );
    expect(values.get('h1')).toEqual({
      power: { value: 32 },
      double: { value: 64 },
      avg: { value: 8 },
    });
  });

  it('reports a missing reference, an empty formula and a cycle', () => {
    const loops = table('loops', [
      { id: 'a', kind: 'formula', expression: 'b + 1' },
      { id: 'b', kind: 'formula', expression: 'a + 1' },
      { id: 'c', kind: 'formula' },
    ]);
    expect(computeTable(loops, [row('l1', 'x')]).get('l1')).toEqual({
      a: { error: 'cycle', name: 'a' },
      b: { error: 'cycle', name: 'b' },
      c: { error: 'empty' },
    });
    const values = computeTable(heroes, [row('h1', 'knight', { level: 1, weapon: 'gone' })], refs);
    expect(values.get('h1')?.['power']).toEqual({ error: 'unknown', name: 'weapon.damage' });
  });
});

describe('validateTable', () => {
  const rules = table('rules', [
    { id: 'name', kind: 'text', required: true, unique: true },
    { id: 'hp', kind: 'number', min: 1, max: 10, integer: true },
    { id: 'rarity', kind: 'choice', options: ['Common'] },
    { id: 'weapon', kind: 'reference', tableId: 'weapons' },
    { id: 'bad', kind: 'formula', expression: 'nope' },
  ]);

  it('flags required, unique, bounds, options, references and formulas', () => {
    const issues = validateTable(
      rules,
      [
        row('r1', 'a', { name: 'Bat', hp: 0, rarity: 'Epic', weapon: 'gone' }),
        row('r2', 'b', { name: 'Bat', hp: 2.5 }),
        row('r3', 'c', { hp: 11 }),
      ],
      refs,
    );
    expect(issues).toEqual([
      { rowId: 'r1', columnId: 'name', code: 'unique' },
      { rowId: 'r1', columnId: 'hp', code: 'min' },
      { rowId: 'r1', columnId: 'rarity', code: 'option' },
      { rowId: 'r1', columnId: 'weapon', code: 'reference' },
      { rowId: 'r1', columnId: 'bad', code: 'formula' },
      { rowId: 'r2', columnId: 'name', code: 'unique' },
      { rowId: 'r2', columnId: 'hp', code: 'integer' },
      { rowId: 'r2', columnId: 'bad', code: 'formula' },
      { rowId: 'r3', columnId: 'name', code: 'required' },
      { rowId: 'r3', columnId: 'hp', code: 'max' },
      { rowId: 'r3', columnId: 'bad', code: 'formula' },
    ]);
  });

  it('flags a value whose type no longer fits the column', () => {
    const issues = validateTable(rules, [row('r1', 'a', { name: 3, hp: 'many' })], refs);
    expect(issues).toContainEqual({ rowId: 'r1', columnId: 'name', code: 'type' });
    expect(issues).toContainEqual({ rowId: 'r1', columnId: 'hp', code: 'type' });
  });
});
