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
    expect(cardFieldSchema.parse({ id: 'r', kind: 'select', options: ['A', 'B'] })).toMatchObject({
      options: ['A', 'B'],
    });
    expect(cardFieldSchema.parse({ id: 's', kind: 'stat', min: 1, max: 9 })).toMatchObject({
      min: 1,
      max: 9,
    });
  });

  it('reads every stored flat field from before kinds had their own shape', () => {
    const legacy = {
      label: 'Field',
      showLabel: true,
      span: 12,
      placeholder: '',
      defaultValue: null,
      options: [],
      min: null,
      max: null,
      linkKinds: [],
      multiple: false,
      style: {},
    };
    const kinds = [
      'heading',
      'text',
      'longText',
      'number',
      'select',
      'checkbox',
      'tags',
      'image',
      'stat',
      'colour',
      'link',
      'divider',
    ] as const;
    for (const kind of kinds) {
      expect(cardFieldSchema.parse({ ...legacy, id: kind, kind }).kind).toBe(kind);
    }
  });

  it('drops a stored default that does not fit the kind', () => {
    expect(cardFieldSchema.parse({ id: 'n', kind: 'number', defaultValue: 'abc' })).toMatchObject({
      defaultValue: null,
    });
    expect(cardFieldSchema.parse({ id: 'c', kind: 'checkbox', defaultValue: 'yes' })).toMatchObject({
      defaultValue: null,
    });
    expect(cardFieldSchema.parse({ id: 't', kind: 'tags', defaultValue: ['a'] })).toMatchObject({
      defaultValue: ['a'],
    });
    expect(() => cardFieldSchema.parse({ id: 'x', kind: 'hologram' })).toThrow();
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
