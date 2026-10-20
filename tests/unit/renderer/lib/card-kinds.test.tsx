import { describe, expect, it } from 'vitest';
import { CARD_FIELD_KINDS, cardFieldSchema, type FieldOf } from '@shared/cards';
import {
  FIELD_GROUPS,
  FIELD_PRESETS,
  cardAccent,
  changeFieldKind,
  coerceValue,
  computeFormulas,
  fieldPresetsByGroup,
  newField,
  presetOf,
  symbolCount,
} from '@renderer/lib/cards';

const field = (input: Parameters<typeof cardFieldSchema.parse>[0]) => cardFieldSchema.parse(input);

describe('field presets', () => {
  it('lists every preset once under one group and covers every kind', () => {
    const grouped = fieldPresetsByGroup();
    const ids = grouped.flatMap((group) => group.presets.map((preset) => preset.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(FIELD_PRESETS.length);
    expect(grouped.map((group) => group.group)).toEqual([...FIELD_GROUPS]);
    const kinds = new Set(FIELD_PRESETS.map((preset) => preset.kind));
    expect([...kinds].sort()).toEqual([...CARD_FIELD_KINDS].sort());
  });

  it('builds fields from presets with their settings', () => {
    expect(newField('heading', 'Name')).toMatchObject({
      kind: 'text',
      showLabel: false,
      style: { size: 'lg', weight: 'bold' },
    });
    expect(newField('longText', 'Bio')).toMatchObject({ kind: 'text', lines: 'multi' });
    expect(newField('staticText', 'Rules')).toMatchObject({ kind: 'text', fixed: true, showLabel: false });
    expect(newField('stat', 'Health')).toMatchObject({
      kind: 'number',
      display: 'bar',
      min: 0,
      max: 100,
      defaultValue: 50,
      span: 12,
    });
    expect(newField('rating', 'Stars')).toMatchObject({ kind: 'number', display: 'symbols', max: 5 });
    expect(newField('range', 'Damage')).toMatchObject({ kind: 'number', range: true });
    expect(newField('choice', 'Rarity')).toMatchObject({
      kind: 'choice',
      multiple: false,
      options: [{ value: 'Option 1' }, { value: 'Option 2' }],
    });
    expect(newField('multiChoice', 'Traits')).toMatchObject({ kind: 'choice', multiple: true });
    expect(newField('tags', 'Tags')).toMatchObject({
      kind: 'choice',
      multiple: true,
      allowNew: true,
      options: [],
    });
    expect(newField('divider', '')).toMatchObject({ kind: 'separator', line: true, showLabel: false });
    expect(newField('spacer', '')).toMatchObject({ kind: 'separator', line: false });
    expect(newField('number', 'Cost').span).toBe(6);
  });

  it('names the preset a field matches', () => {
    for (const preset of FIELD_PRESETS) {
      expect(presetOf(newField(preset.id, preset.id))).toBe(preset.id);
    }
    expect(presetOf(field({ id: 'a', kind: 'text', style: { size: 'lg' } }))).toBe('text');
  });
});

describe('merged kinds', () => {
  it('reads text values unless the text is fixed', () => {
    expect(coerceValue(field({ id: 'a', kind: 'text' }), 'hi')).toBe('hi');
    expect(coerceValue(field({ id: 'a', kind: 'text', fixed: true }), 'hi')).toBeNull();
  });

  it('clamps a number by its display', () => {
    expect(coerceValue(field({ id: 'a', kind: 'number', min: 0, max: 10 }), 99)).toBe(10);
    expect(coerceValue(field({ id: 'a', kind: 'number', display: 'bar' }), 140)).toBe(100);
    expect(coerceValue(field({ id: 'a', kind: 'number', display: 'symbols', max: 5 }), 3.6)).toBe(4);
    expect(coerceValue(field({ id: 'a', kind: 'number', display: 'symbols', max: 5 }), 9)).toBe(5);
    expect(coerceValue(field({ id: 'a', kind: 'number', display: 'symbols', max: 40 }), 40)).toBe(10);
    expect(symbolCount(field({ id: 'a', kind: 'number', display: 'symbols' }) as FieldOf<'number'>)).toBe(5);
    expect(
      symbolCount(field({ id: 'a', kind: 'number', display: 'symbols', max: 0.2 }) as FieldOf<'number'>),
    ).toBe(1);
  });

  it('keeps a low and high pair in order for a range number', () => {
    const range = field({ id: 'a', kind: 'number', range: true, min: 0, max: 10 });
    expect(coerceValue(range, { min: 8, max: 2 })).toEqual({ min: 2, max: 8 });
    expect(coerceValue(range, { min: -5, max: 50 })).toEqual({ min: 0, max: 10 });
    expect(coerceValue(range, 4)).toBeNull();
    expect(coerceValue(field({ id: 'a', kind: 'number' }), { min: 1, max: 2 })).toBeNull();
  });

  it('reads one choice or several, and new entries only when allowed', () => {
    const one = field({ id: 'a', kind: 'choice', options: ['A', 'B'] });
    expect(coerceValue(one, 'B')).toBe('B');
    expect(coerceValue(one, 'C')).toBeNull();
    expect(coerceValue(one, ['A', 'B'])).toBe('A');
    const many = field({ id: 'a', kind: 'choice', options: ['A', 'B'], multiple: true });
    expect(coerceValue(many, ['B', 'C', 'B'])).toEqual(['B']);
    expect(coerceValue(many, 'A')).toEqual(['A']);
    expect(coerceValue(many, [])).toBeNull();
    const tags = field({ id: 'a', kind: 'choice', multiple: true, allowNew: true });
    expect(coerceValue(tags, [' Fire ', '', 4, 'Ice'])).toEqual(['Fire', 'Ice']);
    const free = field({ id: 'a', kind: 'choice', allowNew: true });
    expect(coerceValue(free, ' Elf ')).toBe('Elf');
    expect(coerceValue(free, '  ')).toBeNull();
    expect(coerceValue(field({ id: 'a', kind: 'separator' }), 'x')).toBeNull();
  });

  it('counts every single number display in formulas but not ranges', () => {
    const fields = [
      field({ id: 'hp', kind: 'number', display: 'bar' }),
      field({ id: 'stars', kind: 'number', display: 'symbols' }),
      field({ id: 'dmg', kind: 'number', range: true }),
      field({ id: 'total', kind: 'formula', expression: 'hp + stars' }),
      field({ id: 'bad', kind: 'formula', expression: 'dmg + 1' }),
    ];
    expect(computeFormulas(fields, { hp: 40, stars: 3 })['total']).toEqual({ value: 43 });
    expect(computeFormulas(fields, {})['bad']).toMatchObject({ error: 'unknown' });
  });

  it('takes the accent from the first picked choice', () => {
    const rarity = field({
      id: 'rarity',
      kind: 'choice',
      multiple: true,
      options: [{ value: 'Gold', colour: { hex: '#ffcc00', ref: null } }, 'Grey'],
    });
    const layout = { accent: null, accentField: 'rarity', fields: [rarity] };
    expect(cardAccent(layout, { rarity: ['Gold', 'Grey'] })).toEqual({ hex: '#ffcc00', ref: null });
    expect(cardAccent(layout, {})).toBeNull();
  });

  it('keeps settings both kinds share when the kind changes', () => {
    const text = field({ id: 'role', kind: 'text', label: 'Role', span: 6, placeholder: 'Who', help: 'Why' });
    expect(changeFieldKind(text, 'choice')).toMatchObject({
      id: 'role',
      kind: 'choice',
      label: 'Role',
      span: 6,
      help: 'Why',
      placeholder: 'Who',
      options: [{ value: 'Option 1' }, { value: 'Option 2' }],
    });
    const cost = field({ id: 'cost', kind: 'number', prefix: '$', min: 1, defaultValue: 4 });
    expect(changeFieldKind(cost, 'formula')).toMatchObject({ kind: 'formula', prefix: '$' });
    expect(changeFieldKind(field({ id: 'n', kind: 'text', defaultValue: 'x' }), 'number')).toMatchObject({
      defaultValue: null,
    });
    expect(changeFieldKind(text, 'separator')).not.toHaveProperty('placeholder');
    expect(changeFieldKind(text, 'text')).toBe(text);
  });
});
