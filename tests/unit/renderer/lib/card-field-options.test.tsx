import { describe, expect, it } from 'vitest';
import { cardFieldSchema, type CardField } from '@shared/cards';
import {
  changeFieldKind,
  coerceValue,
  diceNotation,
  diceParts,
  rollDice,
  sampleValues,
} from '@renderer/lib/cards';

const field = (input: Record<string, unknown> & { id: string; kind: CardField['kind'] }): CardField =>
  cardFieldSchema.parse(input);

describe('field options in the schema', () => {
  it('gives dice a builder, allowed sides, odds and a roll button', () => {
    expect(field({ id: 'd', kind: 'dice' })).toMatchObject({
      mode: 'builder',
      sides: [4, 6, 8, 10, 12, 20],
      showOdds: true,
      roll: false,
    });
    expect(field({ id: 'd', kind: 'dice', mode: 'free', sides: [6], roll: true })).toMatchObject({
      mode: 'free',
      sides: [6],
      roll: true,
    });
    expect(() => field({ id: 'd', kind: 'dice', sides: [1] })).toThrow();
  });

  it('gives other kinds options of their own', () => {
    expect(field({ id: 'a', kind: 'attributes' })).toMatchObject({ min: null, max: null, showTotal: false });
    expect(field({ id: 'c', kind: 'checkbox' })).toMatchObject({ onLabel: '', offLabel: '' });
    expect(field({ id: 'd', kind: 'date' })).toMatchObject({ format: 'medium' });
    expect(field({ id: 'l', kind: 'checklist' })).toMatchObject({ showProgress: true });
    expect(field({ id: 'n', kind: 'number' })).toMatchObject({ step: null });
    expect(field({ id: 'o', kind: 'choice' })).toMatchObject({ display: 'dropdown' });
    expect(field({ id: 't', kind: 'text' })).toMatchObject({ maxLength: null });
    expect(() => field({ id: 'd', kind: 'date', format: 'iso' })).toThrow();
    expect(() => field({ id: 'n', kind: 'number', step: 0 })).toThrow();
  });
});

describe('dice helpers', () => {
  it('splits simple notation into count, sides and modifier and joins it back', () => {
    expect(diceParts('2d6+1')).toEqual({ count: 2, sides: 6, modifier: 1 });
    expect(diceParts('d20')).toEqual({ count: 1, sides: 20, modifier: 0 });
    expect(diceParts('3d8-2')).toEqual({ count: 3, sides: 8, modifier: -2 });
    expect(diceParts('2d6+1d4')).toBeNull();
    expect(diceParts('')).toBeNull();
    expect(diceNotation({ count: 2, sides: 6, modifier: 1 })).toBe('2d6+1');
    expect(diceNotation({ count: 1, sides: 20, modifier: 0 })).toBe('1d20');
    expect(diceNotation({ count: 3, sides: 8, modifier: -2 })).toBe('3d8-2');
  });

  it('rolls every die and adds the modifiers', () => {
    const rolls = [0, 0.99, 0.5];
    let at = 0;
    const random = () => rolls[at++ % rolls.length] ?? 0;
    expect(rollDice('2d6+1', random)).toEqual({ total: 1 + 6 + 1, rolls: [1, 6] });
    expect(rollDice('1d4-1d4+3', () => 0.99)).toEqual({ total: 3, rolls: [4, -4] });
    expect(rollDice('nonsense')).toBeNull();
  });
});

describe('values follow the options', () => {
  it('keeps attribute values inside their bounds', () => {
    const stats = field({ id: 'a', kind: 'attributes', min: 1, max: 5, rows: [{ id: 'str', label: 'Str' }] });
    expect(coerceValue(stats, { str: 9 })).toEqual({ str: 5 });
    expect(coerceValue(stats, { str: -2 })).toEqual({ str: 1 });
  });

  it('rounds numbers to their step and cuts text to its maximum length', () => {
    expect(coerceValue(field({ id: 'n', kind: 'number', step: 5 }), 12)).toBe(10);
    expect(coerceValue(field({ id: 'n', kind: 'number', step: 0.5 }), 1.3)).toBe(1.5);
    expect(coerceValue(field({ id: 't', kind: 'text', maxLength: 3 }), 'Dragon')).toBe('Dra');
  });

  it('samples dice from the allowed sides and attributes inside their bounds', () => {
    const fields = [
      field({ id: 'd', kind: 'dice', sides: [12] }),
      field({ id: 'a', kind: 'attributes', min: 7, max: 8, rows: [{ id: 'x', label: 'X' }] }),
    ];
    const values = sampleValues(fields, 4);
    expect(values['d']).toMatch(/^\d+d12$/);
    expect((values['a'] as Record<string, number>)['x']).toBeGreaterThanOrEqual(7);
    expect((values['a'] as Record<string, number>)['x']).toBeLessThanOrEqual(8);
  });
});

describe('changing type with clashing options', () => {
  it('drops a shared key whose value does not fit the new type', () => {
    const chips = field({ id: 'c', kind: 'choice', display: 'chips', label: 'Role' });
    expect(changeFieldKind(chips, 'number')).toMatchObject({
      kind: 'number',
      display: 'number',
      label: 'Role',
    });
    const bar = field({ id: 'n', kind: 'number', display: 'bar' });
    expect(changeFieldKind(bar, 'choice')).toMatchObject({ kind: 'choice', display: 'dropdown' });
  });
});
