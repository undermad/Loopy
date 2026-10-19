import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { cardFieldSchema } from '@shared/cards';
import { parseLinkText } from '@shared/markdown';
import { useLoopyItems } from '@renderer/components/editors/Notes/useLoopyItems';
import {
  blankTemplate,
  coerceValue,
  createCardTemplate,
  createSavedCard,
  deleteCardTemplate,
  deleteSavedCard,
  duplicateSavedCard,
  fieldValue,
  findSavedCard,
  linkTargets,
  newField,
  resolveCardLayout,
  updateSavedCard,
  useSavedCard,
  useSavedCards,
} from '@renderer/lib/cards';
import { closeProject } from '@renderer/lib/project';
import { bootTestApp, makeProject, type FakeApi } from '../helpers/api';

let api: FakeApi;

beforeEach(async () => {
  api = await bootTestApp();
  api.current = makeProject('Space Game');
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

const field = (input: Parameters<typeof cardFieldSchema.parse>[0]) => cardFieldSchema.parse(input);

describe('link fields', () => {
  it('keeps one allowed link, or a list when the field takes many', () => {
    const single = field({ id: 'home', kind: 'link', linkKinds: ['board', 'note'] });
    expect(coerceValue(single, { kind: 'board', id: 'b1' })).toEqual({ kind: 'board', id: 'b1' });
    expect(coerceValue(single, { kind: 'palette', id: 'p1' })).toBeNull();
    expect(
      coerceValue(single, [
        { kind: 'palette', id: 'p1' },
        { kind: 'note', id: 'n1' },
      ]),
    ).toEqual({ kind: 'note', id: 'n1' });
    expect(coerceValue(single, 'board:b1')).toBeNull();

    const many = field({ id: 'refs', kind: 'link', multiple: true });
    expect(
      coerceValue(many, [
        { kind: 'card', id: 'c1' },
        { kind: 'card', id: 'c1' },
        { kind: 'board', id: 'b1' },
        { kind: 'nope', id: 'x' },
      ]),
    ).toEqual([
      { kind: 'card', id: 'c1' },
      { kind: 'board', id: 'b1' },
    ]);
    expect(coerceValue(many, { kind: 'note', id: 'n1' })).toEqual([{ kind: 'note', id: 'n1' }]);
    expect(coerceValue(many, [])).toBeNull();
    expect(fieldValue(many, {})).toBeNull();
    expect(newField('link', 'Home')).toMatchObject({
      kind: 'link',
      span: 12,
      linkKinds: [],
      multiple: false,
    });
  });

  it('lists the targets of any link value', () => {
    expect(linkTargets({ kind: 'note', id: 'n1' })).toEqual([{ kind: 'note', id: 'n1' }]);
    expect(linkTargets([{ kind: 'board', id: 'b1' }])).toEqual([{ kind: 'board', id: 'b1' }]);
    expect(linkTargets('text')).toEqual([]);
    expect(linkTargets(null)).toEqual([]);
  });
});

describe('saved cards store', () => {
  it('creates, edits, duplicates and deletes saved cards and follows the project', async () => {
    const { result } = renderHook(() => useSavedCards());
    expect(result.current).toEqual([]);
    const template = await act(() => createCardTemplate(blankTemplate('Hero')));

    const card = await act(() => createSavedCard({ name: 'Knight', templateId: template.id }));
    expect(result.current?.map((item) => item.name)).toEqual(['Knight']);
    const { result: one } = renderHook(() => useSavedCard(card.id));
    expect(one.current?.templateId).toBe(template.id);
    expect(findSavedCard(card.id)?.name).toBe('Knight');
    expect(findSavedCard(null)).toBeNull();

    await act(() => updateSavedCard(card.id, { values: { title: 'Sir Loop' } }));
    expect(one.current?.values).toEqual({ title: 'Sir Loop' });

    const copy = await act(() => duplicateSavedCard(card.id, 'Knight copy'));
    expect(copy).toMatchObject({
      name: 'Knight copy',
      templateId: template.id,
      values: { title: 'Sir Loop' },
    });
    await expect(duplicateSavedCard('missing', 'x')).resolves.toBeNull();

    await act(() => deleteCardTemplate(template.id));
    expect(result.current?.every((item) => item.templateId === null && item.layout !== null)).toBe(true);

    await act(() => deleteSavedCard(card.id));
    expect(result.current?.map((item) => item.name)).toEqual(['Knight copy']);
    expect(api.deleteCard).toHaveBeenCalledWith(card.id);

    await act(async () => {
      await closeProject();
    });
    expect(result.current).toBeNull();
  });

  it('resolves the layout from the template or the card itself', async () => {
    const template = await act(() => createCardTemplate({ ...blankTemplate('Hero'), width: 300 }));
    const onTemplate = await act(() => createSavedCard({ name: 'A', templateId: template.id }));
    const loose = await act(() => createSavedCard({ name: 'B', layout: { width: 500 } }));
    expect(resolveCardLayout(onTemplate, [template])?.width).toBe(300);
    expect(resolveCardLayout(onTemplate, [])).toBeNull();
    expect(resolveCardLayout(loose, [template])?.width).toBe(500);
  });

  it('resolves card links written in notes', async () => {
    const card = await act(() => createSavedCard({ name: 'Knight' }));
    const { result } = renderHook(() => useLoopyItems());
    const link = parseLinkText('card: knight|the hero');
    expect(link.kind).toBe('card');
    expect(result.current.find('card', link.target)?.id).toBe(card.id);
  });
});
