import { describe, expect, it } from 'vitest';
import { BOARD_LINK_KINDS, cardDataSchema, cardValueSchema } from '@shared/board';
import { cardFieldSchema, savedCardInputSchema, savedCardPatchSchema } from '@shared/cards';
import { LOOPY_LINK_KINDS } from '@shared/markdown';

describe('card schemas', () => {
  it('accepts one asset link or a list of them as a card value', () => {
    expect(cardValueSchema.parse({ kind: 'note', id: 'n1' })).toEqual({ kind: 'note', id: 'n1' });
    expect(
      cardValueSchema.parse([
        { kind: 'board', id: 'b1' },
        { kind: 'card', id: 'c1' },
      ]),
    ).toHaveLength(2);
    expect(cardValueSchema.parse(['a', 'b'])).toEqual(['a', 'b']);
    expect(() => cardValueSchema.parse({ kind: 'video', id: 'x' })).toThrow();
  });

  it('lets cards link to saved cards from boards and notes', () => {
    expect(BOARD_LINK_KINDS).toContain('card');
    expect(LOOPY_LINK_KINDS).toContain('card');
  });

  it('gives a link field all kinds and a single target by default', () => {
    const field = cardFieldSchema.parse({ id: 'home', kind: 'link' });
    expect(field).toMatchObject({ linkKinds: [], multiple: false });
    expect(
      cardFieldSchema.parse({ id: 'x', kind: 'link', linkKinds: ['note'], multiple: true }),
    ).toMatchObject({
      linkKinds: ['note'],
      multiple: true,
    });
    expect(() => cardFieldSchema.parse({ id: 'x', kind: 'link', linkKinds: ['ticket'] })).toThrow();
  });

  it('keeps only the keys a field kind uses', () => {
    const field = cardFieldSchema.parse({
      id: 'name',
      kind: 'text',
      options: ['A'],
      min: 1,
      max: 2,
      linkKinds: ['note'],
      multiple: true,
      placeholder: 'Name',
    });
    expect(field).toMatchObject({ kind: 'text', placeholder: 'Name' });
    expect(field).not.toHaveProperty('options');
    expect(field).not.toHaveProperty('min');
    expect(field).not.toHaveProperty('linkKinds');
    expect(field).not.toHaveProperty('multiple');
    expect(cardFieldSchema.parse({ id: 'r', kind: 'choice', options: ['A', 'B'] })).toMatchObject({
      options: [{ value: 'A' }, { value: 'B' }],
    });
    expect(cardFieldSchema.parse({ id: 's', kind: 'number', display: 'bar', min: 1, max: 9 })).toMatchObject({
      min: 1,
      max: 9,
    });
  });

  it('drops a stored default that does not fit the kind', () => {
    expect(cardFieldSchema.parse({ id: 'n', kind: 'number', defaultValue: 'abc' })).toMatchObject({
      defaultValue: null,
    });
    expect(cardFieldSchema.parse({ id: 'c', kind: 'checkbox', defaultValue: 'yes' })).toMatchObject({
      defaultValue: null,
    });
    expect(
      cardFieldSchema.parse({ id: 't', kind: 'choice', multiple: true, allowNew: true, defaultValue: ['a'] }),
    ).toMatchObject({
      defaultValue: ['a'],
    });
    expect(() => cardFieldSchema.parse({ id: 'x', kind: 'hologram' })).toThrow();
  });

  it('gives every field help text and a hidden flag, and numbers a prefix and suffix', () => {
    expect(cardFieldSchema.parse({ id: 'a', kind: 'separator' })).toMatchObject({ help: '', hidden: false });
    expect(cardFieldSchema.parse({ id: 'n', kind: 'number', prefix: '$', suffix: ' g' })).toMatchObject({
      prefix: '$',
      suffix: ' g',
    });
    expect(cardFieldSchema.parse({ id: 's', kind: 'number', display: 'bar' })).toMatchObject({
      prefix: '',
      suffix: '',
    });
    expect(() => cardFieldSchema.parse({ id: 'h', kind: 'text', help: 'x'.repeat(201) })).toThrow();
  });

  it('gives the new field kinds sensible defaults', () => {
    expect(cardFieldSchema.parse({ id: 'r', kind: 'number', display: 'symbols' })).toMatchObject({
      max: null,
      symbol: 'star',
    });
    expect(cardFieldSchema.parse({ id: 's', kind: 'separator', line: false })).toMatchObject({ size: 16 });
    expect(cardFieldSchema.parse({ id: 't', kind: 'text', fixed: true, text: 'Rules' })).toMatchObject({
      text: 'Rules',
    });
    expect(cardFieldSchema.parse({ id: 'f', kind: 'formula' })).toMatchObject({
      expression: '',
      decimals: null,
    });
    expect(
      cardFieldSchema.parse({ id: 'a', kind: 'attributes', rows: [{ id: 'str', label: 'Strength' }] }),
    ).toMatchObject({
      rows: [{ id: 'str', label: 'Strength' }],
    });
    for (const kind of ['checklist', 'dice', 'icon', 'date'] as const) {
      expect(cardFieldSchema.parse({ id: kind, kind }).kind).toBe(kind);
    }
  });

  it('stores choices with an optional colour and accepts plain names', () => {
    const field = cardFieldSchema.parse({
      id: 'rarity',
      kind: 'choice',
      options: ['Common', { value: 'Rare', colour: { hex: '#3366ff', ref: null } }],
    });
    expect(field).toMatchObject({
      options: [
        { value: 'Common', colour: null },
        { value: 'Rare', colour: { hex: '#3366ff', ref: null } },
      ],
    });
  });

  it('takes a visibility rule on any field', () => {
    expect(cardFieldSchema.parse({ id: 'a', kind: 'text' })).toMatchObject({ visibleWhen: null });
    expect(
      cardFieldSchema.parse({ id: 'a', kind: 'text', visibleWhen: { field: 'b', op: 'equals', value: 'x' } }),
    ).toMatchObject({ visibleWhen: { field: 'b', op: 'equals', value: 'x' } });
    expect(() =>
      cardFieldSchema.parse({ id: 'a', kind: 'text', visibleWhen: { field: 'b', op: 'sometimes' } }),
    ).toThrow();
  });

  it('accepts checklist, range and attribute values on cards', () => {
    expect(cardValueSchema.parse([{ text: 'Find key', done: true }])).toEqual([
      { text: 'Find key', done: true },
    ]);
    expect(cardValueSchema.parse({ min: 1, max: 4 })).toEqual({ min: 1, max: 4 });
    expect(cardValueSchema.parse({ str: 3, dex: null })).toEqual({ str: 3, dex: null });
  });

  it('lets a board card point at a saved card', () => {
    expect(cardDataSchema.parse({}).cardId).toBeNull();
    expect(cardDataSchema.parse({ cardId: 'c1' }).cardId).toBe('c1');
  });

  it('fills saved card input defaults and keeps patches partial', () => {
    expect(savedCardInputSchema.parse({ name: 'Hero' })).toEqual({
      name: 'Hero',
      folderId: null,
      templateId: null,
      layout: null,
      values: {},
    });
    expect(savedCardPatchSchema.parse({ templateId: null })).toEqual({ templateId: null });
    expect(() => savedCardInputSchema.parse({ name: '' })).toThrow();
  });
});
