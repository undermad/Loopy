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
