import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { cardFieldSchema, cardTemplateInputSchema } from '@shared/cards';
import {
  STARTER_TEMPLATES,
  blankTemplate,
  coerceValue,
  uniqueFieldId,
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
      kind: 'number',
      display: 'bar',
      label: 'Health',
      span: 12,
      min: 0,
      max: 100,
      defaultValue: 50,
    });
    expect(newField('choice', 'Rarity')).toMatchObject({
      options: [{ value: 'Option 1' }, { value: 'Option 2' }],
    });
    expect(newField('divider', '').showLabel).toBe(false);
    expect(newField('number', 'Cost').span).toBe(6);
  });

  it('coerces values per kind and falls back to defaults', () => {
    expect(coerceValue(field({ id: 'a', kind: 'text' }), 'hi')).toBe('hi');
    expect(coerceValue(field({ id: 'a', kind: 'text' }), 3)).toBeNull();
    expect(coerceValue(field({ id: 'a', kind: 'number' }), '12')).toBe(12);
    expect(coerceValue(field({ id: 'a', kind: 'number' }), 'x')).toBeNull();
    expect(coerceValue(field({ id: 'a', kind: 'number', display: 'bar', min: 0, max: 10 }), 99)).toBe(10);
    expect(coerceValue(field({ id: 'a', kind: 'checkbox' }), 'yes')).toBeNull();
    expect(coerceValue(field({ id: 'a', kind: 'checkbox' }), true)).toBe(true);
    expect(
      coerceValue(field({ id: 'a', kind: 'choice', multiple: true, allowNew: true }), [
        ' Fire ',
        '',
        4,
        'Ice',
      ]),
    ).toEqual(['Fire', 'Ice']);
    expect(coerceValue(field({ id: 'a', kind: 'choice', options: ['A'] }), 'B')).toBeNull();
    expect(coerceValue(field({ id: 'a', kind: 'colour' }), '#ABCDEF')).toBe('#abcdef');
    expect(coerceValue(field({ id: 'a', kind: 'colour' }), 'red')).toBeNull();
    expect(coerceValue(field({ id: 'a', kind: 'separator' }), 'x')).toBeNull();
    const withDefault = field({ id: 'hp', kind: 'number', defaultValue: 7 });
    expect(fieldValue(withDefault, {})).toBe(7);
    expect(fieldValue(withDefault, { hp: 3 })).toBe(3);
    expect(statFraction(field({ id: 's', kind: 'number', display: 'bar', min: 0, max: 200 }), 50)).toBe(0.25);
    expect(statFraction(field({ id: 's', kind: 'number', display: 'bar', min: 5, max: 5 }), 5)).toBe(0);
    const fields = [
      field({ id: 'a', kind: 'text' }),
      field({ id: 'b', kind: 'text' }),
      field({ id: 'c', kind: 'text' }),
    ];
    expect(moveField(fields, 0, 2).map((item) => item.id)).toEqual(['b', 'c', 'a']);
    expect(moveField(fields, 0, 9)).toBe(fields);
  });

  it('derives readable field ids from labels and keeps them unique', () => {
    expect(newField('stat', 'Max Health').id).toBe('max_health');
    expect(newField('stat', 'Max Health', [{ id: 'max_health' }]).id).toBe('max_health_2');
    expect(newField('text', '').id).toBe('text');
    expect(newField('text', '???').id).toBe('text');
    expect(newField('text', 'Café Menu').id).toBe('cafe_menu');
    expect(newField('text', 'x'.repeat(80)).id.length).toBeLessThanOrEqual(64);
    expect(uniqueFieldId('Name', [{ id: 'name' }, { id: 'name_2' }])).toBe('name_3');
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
