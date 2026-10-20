import { describe, expect, it } from 'vitest';
import { CARD_FIELD_KINDS, NUMBER_DISPLAYS, cardFieldSchema } from '@shared/cards';

describe('merged card field kinds', () => {
  it('keeps one kind per value shape', () => {
    expect([...CARD_FIELD_KINDS].sort()).toEqual(
      [
        'attributes',
        'checkbox',
        'checklist',
        'choice',
        'colour',
        'date',
        'dice',
        'formula',
        'icon',
        'image',
        'link',
        'number',
        'separator',
        'text',
      ].sort(),
    );
    expect(NUMBER_DISPLAYS).toEqual(['number', 'bar', 'symbols']);
  });

  it('rejects the kinds that became settings', () => {
    for (const kind of [
      'heading',
      'longText',
      'staticText',
      'stat',
      'rating',
      'range',
      'select',
      'multiSelect',
      'tags',
      'divider',
      'spacer',
    ]) {
      expect(() => cardFieldSchema.parse({ id: 'x', kind })).toThrow();
    }
  });

  it('gives text one or several lines and fixed text', () => {
    expect(cardFieldSchema.parse({ id: 't', kind: 'text' })).toMatchObject({
      lines: 'single',
      fixed: false,
      text: '',
      placeholder: '',
      defaultValue: null,
    });
    expect(
      cardFieldSchema.parse({ id: 't', kind: 'text', lines: 'multi', fixed: true, text: 'Rules' }),
    ).toMatchObject({ lines: 'multi', fixed: true, text: 'Rules' });
    expect(() => cardFieldSchema.parse({ id: 't', kind: 'text', lines: 'many' })).toThrow();
    expect(() => cardFieldSchema.parse({ id: 't', kind: 'text', text: 'x'.repeat(2001) })).toThrow();
  });

  it('draws a number as a number, a bar or symbols, or holds a low and high pair', () => {
    expect(cardFieldSchema.parse({ id: 'n', kind: 'number' })).toMatchObject({
      display: 'number',
      symbol: 'star',
      range: false,
      min: null,
      max: null,
      prefix: '',
      suffix: '',
      defaultValue: null,
    });
    expect(
      cardFieldSchema.parse({ id: 'n', kind: 'number', display: 'symbols', symbol: 'heart', max: 5 }),
    ).toMatchObject({ display: 'symbols', symbol: 'heart', max: 5 });
    expect(
      cardFieldSchema.parse({ id: 'n', kind: 'number', defaultValue: { min: 1, max: 3 } }),
    ).toMatchObject({
      defaultValue: { min: 1, max: 3 },
    });
    expect(cardFieldSchema.parse({ id: 'n', kind: 'number', defaultValue: 'x' })).toMatchObject({
      defaultValue: null,
    });
    expect(() => cardFieldSchema.parse({ id: 'n', kind: 'number', display: 'pie' })).toThrow();
  });

  it('lets a choice take several values and new entries', () => {
    expect(cardFieldSchema.parse({ id: 'c', kind: 'choice', options: ['A'] })).toMatchObject({
      multiple: false,
      allowNew: false,
      options: [{ value: 'A', colour: null }],
      defaultValue: null,
    });
    expect(
      cardFieldSchema.parse({ id: 'c', kind: 'choice', multiple: true, allowNew: true, defaultValue: ['a'] }),
    ).toMatchObject({ multiple: true, allowNew: true, defaultValue: ['a'] });
    expect(cardFieldSchema.parse({ id: 'c', kind: 'choice', defaultValue: 'A' })).toMatchObject({
      defaultValue: 'A',
    });
    expect(cardFieldSchema.parse({ id: 'c', kind: 'choice', defaultValue: 4 })).toMatchObject({
      defaultValue: null,
    });
  });

  it('draws a separator as a line or empty space', () => {
    expect(cardFieldSchema.parse({ id: 's', kind: 'separator' })).toMatchObject({
      showLabel: false,
      line: true,
      size: 16,
    });
    expect(cardFieldSchema.parse({ id: 's', kind: 'separator', line: false, size: 40 })).toMatchObject({
      line: false,
      size: 40,
    });
    expect(() => cardFieldSchema.parse({ id: 's', kind: 'separator', size: 2 })).toThrow();
  });
});
