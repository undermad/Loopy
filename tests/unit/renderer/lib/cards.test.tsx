import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CARD_FIELD_KINDS, cardFieldSchema, cardTemplateInputSchema } from '@shared/cards';
import {
  FIELD_GROUPS,
  STARTER_TEMPLATES,
  blankTemplate,
  changeFieldKind,
  coerceValue,
  fieldKindsByGroup,
  createCardTemplate,
  deleteCardTemplate,
  duplicateCardTemplate,
  fieldValue,
  findCardTemplate,
  moveField,
  newField,
  statFraction,
  updateCardTemplate,
  useCardTemplate,
  useCardTemplates,
} from '@renderer/lib/cards';
import { closeProject } from '@renderer/lib/project';
import { bootTestApp, makeProject, type FakeApi } from '../helpers/api';

let api: FakeApi;

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

const field = (input: Parameters<typeof cardFieldSchema.parse>[0]) => cardFieldSchema.parse(input);

describe('card fields', () => {
  it('creates fields with kind defaults and unique ids', () => {
    const stat = newField('stat', 'Health');
    expect(stat).toMatchObject({
      kind: 'stat',
      label: 'Health',
      span: 12,
      min: 0,
      max: 100,
      defaultValue: 50,
    });
    expect(newField('select', 'Rarity')).toMatchObject({ options: ['Option 1', 'Option 2'] });
    expect(newField('divider', '').showLabel).toBe(false);
    expect(newField('number', 'Cost').span).toBe(6);
    const ids = new Set(Array.from({ length: 20 }, () => newField('text', 'x').id));
    expect(ids.size).toBe(20);
  });

  it('coerces values per kind and falls back to defaults', () => {
    expect(coerceValue(field({ id: 'a', kind: 'text' }), 'hi')).toBe('hi');
    expect(coerceValue(field({ id: 'a', kind: 'text' }), 3)).toBeNull();
    expect(coerceValue(field({ id: 'a', kind: 'number' }), '12')).toBe(12);
    expect(coerceValue(field({ id: 'a', kind: 'number' }), 'x')).toBeNull();
    expect(coerceValue(field({ id: 'a', kind: 'stat', min: 0, max: 10 }), 99)).toBe(10);
    expect(coerceValue(field({ id: 'a', kind: 'checkbox' }), 'yes')).toBeNull();
    expect(coerceValue(field({ id: 'a', kind: 'checkbox' }), true)).toBe(true);
    expect(coerceValue(field({ id: 'a', kind: 'tags' }), [' Fire ', '', 4, 'Ice'])).toEqual(['Fire', 'Ice']);
    expect(coerceValue(field({ id: 'a', kind: 'select', options: ['A'] }), 'B')).toBeNull();
    expect(coerceValue(field({ id: 'a', kind: 'colour' }), '#ABCDEF')).toBe('#abcdef');
    expect(coerceValue(field({ id: 'a', kind: 'colour' }), 'red')).toBeNull();
    expect(coerceValue(field({ id: 'a', kind: 'divider' }), 'x')).toBeNull();
    const withDefault = field({ id: 'hp', kind: 'number', defaultValue: 7 });
    expect(fieldValue(withDefault, {})).toBe(7);
    expect(fieldValue(withDefault, { hp: 3 })).toBe(3);
    expect(statFraction(field({ id: 's', kind: 'stat', min: 0, max: 200 }), 50)).toBe(0.25);
    expect(statFraction(field({ id: 's', kind: 'stat', min: 5, max: 5 }), 5)).toBe(0);
    const fields = [
      field({ id: 'a', kind: 'text' }),
      field({ id: 'b', kind: 'text' }),
      field({ id: 'c', kind: 'text' }),
    ];
    expect(moveField(fields, 0, 2).map((item) => item.id)).toEqual(['b', 'c', 'a']);
    expect(moveField(fields, 0, 9)).toBe(fields);
  });

  it('files every field kind under exactly one group', () => {
    const grouped = fieldKindsByGroup();
    const listed = grouped.flatMap((group) => group.kinds);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual([...CARD_FIELD_KINDS].sort());
    expect(grouped.map((group) => group.group)).toEqual([...FIELD_GROUPS]);
  });

  it('changes a field kind but keeps its id, label, width and style', () => {
    const text = field({
      id: 'role',
      kind: 'text',
      label: 'Role',
      span: 6,
      placeholder: 'Who',
      style: { weight: 'bold' },
    });
    const select = changeFieldKind(text, 'select');
    expect(select).toMatchObject({
      id: 'role',
      kind: 'select',
      label: 'Role',
      span: 6,
      style: { weight: 'bold' },
      options: ['Option 1', 'Option 2'],
    });
    expect(changeFieldKind(text, 'stat')).toMatchObject({ min: 0, max: 100, defaultValue: 50 });
    expect(changeFieldKind(text, 'divider')).not.toHaveProperty('placeholder');
    expect(changeFieldKind(text, 'text')).toBe(text);
  });

  it('ships valid starter and blank templates', () => {
    for (const starter of STARTER_TEMPLATES) {
      const parsed = cardTemplateInputSchema.parse(starter.template);
      expect(new Set(parsed.fields.map((item) => item.id)).size).toBe(parsed.fields.length);
    }
    expect(cardTemplateInputSchema.parse(blankTemplate('Card 1')).fields).toHaveLength(2);
  });
});

describe('card templates store', () => {
  it('creates, updates, duplicates and deletes templates and follows the project', async () => {
    const { result } = renderHook(() => ({ list: useCardTemplates() }));
    expect(result.current.list).toEqual([]);
    const created = await act(() => createCardTemplate(blankTemplate('Hero')));
    expect(result.current.list?.map((item) => item.name)).toEqual(['Hero']);
    const { result: one } = renderHook(() => useCardTemplate(created.id));
    expect(one.current?.name).toBe('Hero');
    expect(findCardTemplate(created.id)?.id).toBe(created.id);
    expect(findCardTemplate(null)).toBeNull();

    await act(() => updateCardTemplate(created.id, { name: 'Villain', width: 400 }));
    expect(result.current.list?.[0]).toMatchObject({ name: 'Villain', width: 400 });
    const copy = await act(() => duplicateCardTemplate(created.id, 'Villain copy'));
    expect(copy?.fields).toEqual(result.current.list?.[0]?.fields);
    await expect(duplicateCardTemplate('missing', 'x')).resolves.toBeNull();
    expect(result.current.list).toHaveLength(2);

    await act(() => deleteCardTemplate(created.id));
    expect(result.current.list?.map((item) => item.name)).toEqual(['Villain copy']);
    expect(api.deleteCardTemplate).toHaveBeenCalledWith(created.id);

    await act(async () => {
      await closeProject();
    });
    expect(result.current.list).toBeNull();
  });
});
