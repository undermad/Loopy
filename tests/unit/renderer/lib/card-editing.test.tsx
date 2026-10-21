import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cardFieldSchema, type CardField } from '@shared/cards';
import {
  FIELD_BLOCKS,
  coerceValue,
  copyFieldsToClipboard,
  duplicateFields,
  fieldClipboard,
  fieldsFromLines,
  fitCardHeight,
  moveFieldBy,
  newBlock,
  nextCopyLabel,
  overflowingFields,
  pasteFields,
  pushHistory,
  redoHistory,
  removeFields,
  renameFieldId,
  sampleValues,
  startHistory,
  undoHistory,
  useHistory,
} from '@renderer/lib/cards';

const field = (input: Record<string, unknown> & { id: string }): CardField =>
  cardFieldSchema.parse({ kind: 'text', ...input });

describe('history', () => {
  it('undoes and redoes values and drops the future on a new change', () => {
    let history = startHistory(1);
    history = pushHistory(history, 2, null, 0);
    history = pushHistory(history, 3, null, 10);
    expect(history.present).toBe(3);
    history = undoHistory(history);
    expect(history.present).toBe(2);
    history = redoHistory(history);
    expect(history.present).toBe(3);
    history = undoHistory(undoHistory(history));
    expect(history.present).toBe(1);
    expect(undoHistory(history)).toBe(history);
    history = pushHistory(history, 9, null, 20);
    expect(history.future).toEqual([]);
    expect(redoHistory(history)).toBe(history);
  });

  it('merges quick changes with the same key into one step', () => {
    let history = startHistory('');
    history = pushHistory(history, 'a', 'name', 0);
    history = pushHistory(history, 'ab', 'name', 300);
    history = pushHistory(history, 'abc', 'name', 600);
    expect(history.past).toEqual(['']);
    history = pushHistory(history, 'abcd', 'name', 5000);
    expect(history.past).toEqual(['', 'abc']);
    history = pushHistory(history, 'x', 'other', 5100);
    expect(history.past).toEqual(['', 'abc', 'abcd']);
    expect(pushHistory(history, 'x', null, 5200)).toBe(history);
  });

  it('keeps at most 100 steps', () => {
    let history = startHistory(0);
    for (let step = 1; step <= 150; step += 1) history = pushHistory(history, step, null, step * 2000);
    expect(history.past).toHaveLength(100);
    expect(history.past[0]).toBe(50);
  });

  it('binds to React with set, undo, redo and reset', () => {
    const { result } = renderHook(() => useHistory({ n: 1 }));
    expect(result.current.canUndo).toBe(false);
    act(() => {
      result.current.set((value) => ({ n: value.n + 1 }));
    });
    expect(result.current.value).toEqual({ n: 2 });
    expect(result.current.canUndo).toBe(true);
    act(() => {
      result.current.undo();
    });
    expect(result.current.value).toEqual({ n: 1 });
    expect(result.current.canRedo).toBe(true);
    act(() => {
      result.current.redo();
    });
    expect(result.current.value).toEqual({ n: 2 });
    act(() => {
      result.current.reset({ n: 7 });
    });
    expect(result.current).toMatchObject({ value: { n: 7 }, canUndo: false, canRedo: false });
  });
});

describe('field editing', () => {
  const fields = [
    field({ id: 'name', label: 'Name' }),
    field({ id: 'attack', kind: 'number', label: 'Attack' }),
    field({ id: 'power', kind: 'formula', label: 'Power', expression: 'attack * 2' }),
    field({
      id: 'note',
      label: 'Note',
      zone: 'footer',
      visibleWhen: { field: 'attack', op: 'filled', value: '' },
    }),
  ];

  it('numbers copied labels', () => {
    expect(nextCopyLabel('Attack')).toBe('Attack 2');
    expect(nextCopyLabel('Attack 2')).toBe('Attack 3');
    expect(nextCopyLabel('Level 10')).toBe('Level 11');
    expect(nextCopyLabel('')).toBe('');
  });

  it('duplicates fields after themselves with new ids and labels', () => {
    const { fields: next, ids } = duplicateFields(fields, ['attack', 'name']);
    expect(next.map((item) => item.id)).toEqual(['name', 'name_2', 'attack', 'attack_2', 'power', 'note']);
    expect(next[3]).toMatchObject({ label: 'Attack 2', kind: 'number' });
    expect(ids).toEqual(['name_2', 'attack_2']);
  });

  it('removes fields', () => {
    expect(removeFields(fields, ['name', 'note']).map((item) => item.id)).toEqual(['attack', 'power']);
  });

  it('copies fields and pastes them with fresh ids and references kept inside the copy', () => {
    copyFieldsToClipboard(fields, ['power', 'attack']);
    expect(fieldClipboard()?.map((item) => item.id)).toEqual(['attack', 'power']);
    const { fields: next, ids } = pasteFields(fields, fieldClipboard() ?? [], 'name');
    expect(ids).toEqual(['attack_2', 'power_2']);
    expect(next.map((item) => item.id)).toEqual(['name', 'attack_2', 'power_2', 'attack', 'power', 'note']);
    expect(next[2]).toMatchObject({ expression: 'attack_2 * 2' });
    const note = field({
      id: 'note',
      label: 'Note',
      visibleWhen: { field: 'attack', op: 'filled', value: '' },
    });
    const other = pasteFields([], [note], null);
    expect(other.fields[0]).toMatchObject({ id: 'note', visibleWhen: { field: 'attack' } });
  });

  it('pastes into the zone of the field it follows', () => {
    const { fields: next } = pasteFields(fields, [field({ id: 'x', label: 'X' })], 'note');
    expect(next.at(-1)).toMatchObject({ id: 'x', zone: 'footer' });
  });

  it('moves a field one step within its zone', () => {
    expect(moveFieldBy(fields, 'attack', -1).map((item) => item.id)).toEqual([
      'attack',
      'name',
      'power',
      'note',
    ]);
    expect(moveFieldBy(fields, 'power', 1)).toBe(fields);
    expect(moveFieldBy(fields, 'name', -1)).toBe(fields);
    expect(moveFieldBy(fields, 'missing', 1)).toBe(fields);
  });

  it('renames a field id and updates formulas, show when rules and the accent', () => {
    const renamed = renameFieldId({ fields, accentField: 'attack' }, 'attack', 'Strike Power');
    expect(renamed.id).toBe('strike_power');
    expect(renamed.accentField).toBe('strike_power');
    expect(renamed.fields.map((item) => item.id)).toContain('strike_power');
    expect(renamed.fields[2]).toMatchObject({ expression: 'strike_power * 2' });
    expect(renamed.fields[3]).toMatchObject({ visibleWhen: { field: 'strike_power' } });
    expect(renameFieldId({ fields, accentField: null }, 'attack', 'name').id).toBe('name_2');
    expect(renameFieldId({ fields, accentField: null }, 'attack', '').id).toBe('attack');
  });

  it('adds one field per line', () => {
    const added = fieldsFromLines('Strength\n\n  Agility  \nStrength', 'number', fields);
    expect(added.map((item) => [item.id, item.label, item.kind])).toEqual([
      ['strength', 'Strength', 'number'],
      ['agility', 'Agility', 'number'],
      ['strength_2', 'Strength', 'number'],
    ]);
    expect(fieldsFromLines('   ', 'text', fields)).toEqual([]);
  });

  it('builds blocks of several fields with unique ids', () => {
    expect(FIELD_BLOCKS.map((block) => block.id)).toEqual(['stats', 'title', 'badge']);
    const stats = newBlock('stats', [field({ id: 'attack' })]);
    expect(stats.map((item) => [item.id, item.span])).toEqual([
      ['attack_2', 4],
      ['defence', 4],
      ['speed', 4],
    ]);
    expect(newBlock('title', []).map((item) => item.kind)).toEqual(['text', 'text']);
  });

  it('fills sample values that every field accepts', () => {
    const all = [
      field({ id: 'a', label: 'Name' }),
      field({ id: 'b', lines: 'multi' }),
      field({ id: 'c', kind: 'number', min: 2, max: 4 }),
      field({ id: 'd', kind: 'number', display: 'bar' }),
      field({ id: 'e', kind: 'number', display: 'symbols', max: 3 }),
      field({ id: 'f', kind: 'number', range: true, min: 0, max: 10 }),
      field({ id: 'g', kind: 'choice', options: ['X', 'Y'] }),
      field({ id: 'h', kind: 'choice', multiple: true, allowNew: true }),
      field({ id: 'i', kind: 'date' }),
      field({ id: 'j', kind: 'checkbox' }),
      field({ id: 'k', kind: 'checklist' }),
      field({ id: 'l', kind: 'dice' }),
      field({ id: 'm', kind: 'colour' }),
      field({ id: 'n', kind: 'attributes', rows: [{ id: 'str', label: 'Str' }] }),
      field({ id: 'o', fixed: true }),
    ];
    const values = sampleValues(all, 3);
    for (const item of all.slice(0, -1)) {
      expect(values[item.id], item.id).not.toBeUndefined();
      expect(coerceValue(item, values[item.id]), item.id).toEqual(values[item.id]);
    }
    expect(values['o']).toBeUndefined();
    expect(sampleValues(all, 3)).toEqual(values);
  });

  it('finds fields cut off by the card and the height that fits them', () => {
    expect(
      overflowingFields(
        [
          { id: 'a', bottom: 90 },
          { id: 'b', bottom: 140 },
        ],
        100,
      ),
    ).toEqual(['b']);
    expect(fitCardHeight(360, 500, 300)).toBe(560);
    expect(fitCardHeight(360, 300, 300)).toBe(360);
    expect(fitCardHeight(3900, 6000, 300)).toBe(4000);
  });
});
