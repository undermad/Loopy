import { describe, expect, it } from 'vitest';
import { cardFieldSchema, type CardField } from '@shared/cards';
import {
  coerceValue,
  computeFormulas,
  evaluateFormula,
  fieldValue,
  isFieldVisible,
  parseDice,
} from '@renderer/lib/cards';

const field = (input: Record<string, unknown> & { id: string; kind: CardField['kind'] }) =>
  cardFieldSchema.parse(input);

describe('formulas', () => {
  it('follows operator precedence, brackets and powers', () => {
    expect(evaluateFormula('1 + 2 * 3', {})).toEqual({ value: 7 });
    expect(evaluateFormula('(1 + 2) * 3', {})).toEqual({ value: 9 });
    expect(evaluateFormula('2 ^ 3 ^ 2', {})).toEqual({ value: 512 });
    expect(evaluateFormula('10 % 4', {})).toEqual({ value: 2 });
    expect(evaluateFormula('-attack + 10', { attack: 4 })).toEqual({ value: 6 });
    expect(evaluateFormula('1.5 * 2', {})).toEqual({ value: 3 });
  });

  it('knows a few functions and comparisons', () => {
    expect(evaluateFormula('min(3, 1, 2) + max(4, 9)', {})).toEqual({ value: 10 });
    expect(evaluateFormula('clamp(15, 0, 10)', {})).toEqual({ value: 10 });
    expect(evaluateFormula('round(2.5) + floor(1.9) + ceil(0.1) + abs(-2)', {})).toEqual({ value: 7 });
    expect(evaluateFormula('sqrt(16)', {})).toEqual({ value: 4 });
    expect(evaluateFormula('if(level > 5, 10, 1)', { level: 6 })).toEqual({ value: 10 });
    expect(evaluateFormula('if(level >= 5, 10, 1)', { level: 4 })).toEqual({ value: 1 });
    expect(evaluateFormula('(a == 2) + (a != 2) + (a < 3) + (a <= 1)', { a: 2 })).toEqual({ value: 2 });
  });

  it('reports mistakes instead of throwing', () => {
    expect(evaluateFormula('', {})).toEqual({ error: 'empty' });
    expect(evaluateFormula('2 +', {})).toEqual({ error: 'syntax' });
    expect(evaluateFormula('(1 + 2', {})).toEqual({ error: 'syntax' });
    expect(evaluateFormula('foo + 1', {})).toEqual({ error: 'unknown', name: 'foo' });
    expect(evaluateFormula('nope(1)', {})).toEqual({ error: 'unknown', name: 'nope' });
    expect(evaluateFormula('max()', {})).toEqual({ error: 'syntax' });
    expect(evaluateFormula('clamp(1, 2)', {})).toEqual({ error: 'syntax' });
    expect(evaluateFormula('1 / 0', {})).toEqual({ error: 'number' });
    expect(evaluateFormula('"x"', {})).toEqual({ error: 'syntax' });
    expect(evaluateFormula('1 2', {})).toEqual({ error: 'syntax' });
    expect(evaluateFormula('1'.repeat(501), {})).toEqual({ error: 'syntax' });
  });

  it('works out formula fields from other fields, including other formulas', () => {
    const fields = [
      field({ id: 'level', kind: 'number' }),
      field({ id: 'hp', kind: 'stat', min: 0, max: 100 }),
      field({ id: 'ready', kind: 'checkbox' }),
      field({ id: 'power', kind: 'formula', expression: 'level * 2 + ready' }),
      field({ id: 'total', kind: 'formula', expression: 'power + hp' }),
      field({ id: 'loop_a', kind: 'formula', expression: 'loop_b + 1' }),
      field({ id: 'loop_b', kind: 'formula', expression: 'loop_a + 1' }),
      field({ id: 'name', kind: 'text' }),
    ];
    const results = computeFormulas(fields, { level: 3, hp: 40, ready: true });
    expect(results['power']).toEqual({ value: 7 });
    expect(results['total']).toEqual({ value: 47 });
    expect(results['loop_a']).toEqual({ error: 'cycle' });
    expect(evaluateFormula('name', { level: 1 })).toEqual({ error: 'unknown', name: 'name' });
    expect(computeFormulas(fields, {})['power']).toEqual({ value: 0 });
  });
});

describe('dice', () => {
  it('reads dice notation and works out the range and average', () => {
    expect(parseDice('2d6+1')).toEqual({ notation: '2d6+1', min: 3, max: 13, average: 8 });
    expect(parseDice('d20')).toEqual({ notation: 'd20', min: 1, max: 20, average: 10.5 });
    expect(parseDice(' 1D4 - 1 ')).toEqual({ notation: '1d4-1', min: 0, max: 3, average: 1.5 });
    expect(parseDice('1d20+2d4-1')).toMatchObject({ min: 2, max: 27 });
    expect(parseDice('5')).toEqual({ notation: '5', min: 5, max: 5, average: 5 });
  });

  it('rejects anything else', () => {
    for (const bad of ['', 'abc', '0d6', '2d1', '101d6', '1d1001', '2d6+', '2d6*2', 'd']) {
      expect(parseDice(bad)).toBeNull();
    }
  });
});

describe('visibility rules', () => {
  const fields = [
    field({ id: 'role', kind: 'select', options: ['Hero', 'Boss'] }),
    field({ id: 'level', kind: 'number' }),
    field({ id: 'phase', kind: 'text', visibleWhen: { field: 'role', op: 'equals', value: 'Boss' } }),
    field({ id: 'notRole', kind: 'text', visibleWhen: { field: 'role', op: 'notEquals', value: 'Boss' } }),
    field({ id: 'perk', kind: 'text', visibleWhen: { field: 'level', op: 'above', value: '5' } }),
    field({ id: 'tutorial', kind: 'text', visibleWhen: { field: 'level', op: 'below', value: '2' } }),
    field({ id: 'named', kind: 'text', visibleWhen: { field: 'role', op: 'filled', value: '' } }),
    field({ id: 'blank', kind: 'text', visibleWhen: { field: 'role', op: 'empty', value: '' } }),
    field({ id: 'orphan', kind: 'text', visibleWhen: { field: 'gone', op: 'filled', value: '' } }),
  ];
  const visible = (values: Record<string, unknown>) =>
    fields.filter((item) => isFieldVisible(item, fields, values as never)).map((item) => item.id);

  it('shows a field only while its rule holds', () => {
    expect(visible({ role: 'Boss', level: 9 })).toEqual([
      'role',
      'level',
      'phase',
      'perk',
      'named',
      'orphan',
    ]);
    expect(visible({ level: 1 })).toEqual(['role', 'level', 'notRole', 'tutorial', 'blank', 'orphan']);
  });
});

describe('new field values', () => {
  it('keeps ratings whole and within the maximum', () => {
    const rating = field({ id: 'r', kind: 'rating', max: 5 });
    expect(coerceValue(rating, 3.6)).toBe(4);
    expect(coerceValue(rating, 9)).toBe(5);
    expect(coerceValue(rating, -1)).toBe(0);
    expect(coerceValue(rating, 'x')).toBeNull();
  });

  it('orders a range and clamps it to the bounds', () => {
    const range = field({ id: 'g', kind: 'range', min: 0, max: 10 });
    expect(coerceValue(range, { min: 8, max: 2 })).toEqual({ min: 2, max: 8 });
    expect(coerceValue(range, { min: -5, max: 20 })).toEqual({ min: 0, max: 10 });
    expect(coerceValue(range, { min: 'a', max: 2 })).toBeNull();
  });

  it('cleans checklists, multiple choices, attributes, dice, icons and dates', () => {
    expect(
      coerceValue(field({ id: 'c', kind: 'checklist' }), [
        { text: ' Key ', done: true },
        { text: '', done: false },
        { text: 'Door' },
        'junk',
      ]),
    ).toEqual([
      { text: 'Key', done: true },
      { text: 'Door', done: false },
    ]);
    const multi = field({ id: 'm', kind: 'multiSelect', options: ['Fire', 'Ice'] });
    expect(coerceValue(multi, ['Ice', 'Mud', 'Ice'])).toEqual(['Ice']);
    expect(coerceValue(multi, [])).toBeNull();
    const attributes = field({
      id: 'a',
      kind: 'attributes',
      rows: [
        { id: 'str', label: 'Strength' },
        { id: 'dex', label: 'Dexterity' },
      ],
    });
    expect(coerceValue(attributes, { str: 4, dex: 'x', luck: 9 })).toEqual({ str: 4 });
    expect(coerceValue(attributes, { luck: 9 })).toBeNull();
    expect(coerceValue(field({ id: 'd', kind: 'dice' }), '2D6 + 1')).toBe('2d6+1');
    expect(coerceValue(field({ id: 'd', kind: 'dice' }), 'lots')).toBeNull();
    expect(coerceValue(field({ id: 'i', kind: 'icon' }), 'sword')).toBe('sword');
    expect(coerceValue(field({ id: 'i', kind: 'icon' }), 'x'.repeat(41))).toBeNull();
    expect(coerceValue(field({ id: 'w', kind: 'date' }), '2026-10-19')).toBe('2026-10-19');
    expect(coerceValue(field({ id: 'w', kind: 'date' }), '2026-13-40')).toBeNull();
    expect(coerceValue(field({ id: 's', kind: 'staticText' }), 'x')).toBeNull();
    expect(coerceValue(field({ id: 's', kind: 'select', options: ['A'] }), 'A')).toBe('A');
    expect(fieldValue(field({ id: 'f', kind: 'formula', expression: '1' }), { f: 3 })).toBeNull();
  });
});
