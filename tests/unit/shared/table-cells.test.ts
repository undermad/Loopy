import { describe, expect, it } from 'vitest';
import { formatCell, parseCell, tableColumnSchema, type TableRow } from '@shared/tables';

const column = (input: Record<string, unknown>) => tableColumnSchema.parse({ id: 'c', ...input });

const row = (id: string, key: string): TableRow => ({
  id,
  key,
  position: 'a',
  cells: {},
  updatedAt: '2026-10-21T00:00:00.000Z',
});

const refs = { rowsOf: () => [row('r1', 'sword'), row('r2', 'bow')] };

describe('parseCell', () => {
  it('reads text and trims it to the limit', () => {
    expect(parseCell(column({ kind: 'text' }), '  Iron  ')).toEqual({ value: 'Iron' });
    expect(parseCell(column({ kind: 'text', maxLength: 3 }), 'Iron')).toEqual({ value: 'Iro' });
    expect(parseCell(column({ kind: 'text' }), '   ')).toEqual({ value: null });
  });

  it('reads numbers in either decimal style and rounds integers', () => {
    expect(parseCell(column({ kind: 'number' }), '1.5')).toEqual({ value: 1.5 });
    expect(parseCell(column({ kind: 'number' }), '1,5')).toEqual({ value: 1.5 });
    expect(parseCell(column({ kind: 'number', integer: true }), '2.6')).toEqual({ value: 3 });
    expect(parseCell(column({ kind: 'number' }), '12%')).toEqual({ error: 'number' });
  });

  it('reads yes and no in several spellings', () => {
    const box = column({ kind: 'checkbox' });
    for (const text of ['true', 'Yes', '1', 'x', 'TRUE'])
      expect(parseCell(box, text)).toEqual({ value: true });
    for (const text of ['false', 'no', '0', '']) expect(parseCell(box, text)).toEqual({ value: false });
    expect(parseCell(box, 'maybe')).toEqual({ error: 'checkbox' });
  });

  it('matches choices without case and splits several on commas', () => {
    const one = column({ kind: 'choice', options: ['Common', 'Rare'] });
    expect(parseCell(one, 'rare')).toEqual({ value: 'Rare' });
    expect(parseCell(one, 'Epic')).toEqual({ error: 'option' });
    const many = column({ kind: 'choice', options: ['Fire', 'Ice'], multiple: true });
    expect(parseCell(many, 'ice, fire')).toEqual({ value: ['Ice', 'Fire'] });
    expect(parseCell(many, '')).toEqual({ value: null });
  });

  it('reads dates, colours, images and dice', () => {
    expect(parseCell(column({ kind: 'date' }), '2026-02-03')).toEqual({ value: '2026-02-03' });
    expect(parseCell(column({ kind: 'date' }), '2026-02-30')).toEqual({ error: 'date' });
    expect(parseCell(column({ kind: 'colour' }), '#AABBCC')).toEqual({ value: '#aabbcc' });
    expect(parseCell(column({ kind: 'colour' }), 'red')).toEqual({ error: 'colour' });
    expect(parseCell(column({ kind: 'image' }), 'asset-1')).toEqual({ value: 'asset-1' });
    expect(parseCell(column({ kind: 'dice' }), '2D6 + 1')).toEqual({ value: '2d6+1' });
    expect(parseCell(column({ kind: 'dice' }), 'lots')).toEqual({ error: 'dice' });
  });

  it('resolves references by key and refuses unknown keys', () => {
    const one = column({ kind: 'reference', tableId: 't2' });
    expect(parseCell(one, 'bow', refs)).toEqual({ value: 'r2' });
    expect(parseCell(one, 'axe', refs)).toEqual({ error: 'reference' });
    const many = column({ kind: 'reference', tableId: 't2', multiple: true });
    expect(parseCell(many, 'bow, sword', refs)).toEqual({ value: ['r2', 'r1'] });
    expect(parseCell(one, 'bow')).toEqual({ error: 'reference' });
  });

  it('never stores formulas or links typed as text', () => {
    expect(parseCell(column({ kind: 'formula' }), '3')).toEqual({ value: null });
    expect(parseCell(column({ kind: 'link' }), 'board')).toEqual({ value: null });
  });
});

describe('formatCell', () => {
  it('shows each kind as text', () => {
    expect(formatCell(column({ kind: 'text' }), 'Iron')).toBe('Iron');
    expect(formatCell(column({ kind: 'number' }), 1.5)).toBe('1.5');
    expect(formatCell(column({ kind: 'checkbox' }), true)).toBe('true');
    expect(formatCell(column({ kind: 'choice', multiple: true }), ['Fire', 'Ice'])).toBe('Fire, Ice');
    expect(formatCell(column({ kind: 'reference', tableId: 't2' }), 'r2', refs)).toBe('bow');
    expect(
      formatCell(column({ kind: 'reference', tableId: 't2', multiple: true }), ['r1', 'gone'], refs),
    ).toBe('sword, ?');
    expect(formatCell(column({ kind: 'link' }), { kind: 'board', id: 'b1' })).toBe('board:b1');
    expect(formatCell(column({ kind: 'text' }), null)).toBe('');
    expect(formatCell(column({ kind: 'text' }), undefined)).toBe('');
  });

  it('round-trips through parseCell', () => {
    const many = column({ kind: 'reference', tableId: 't2', multiple: true });
    expect(parseCell(many, formatCell(many, ['r1', 'r2'], refs), refs)).toEqual({ value: ['r1', 'r2'] });
  });
});
