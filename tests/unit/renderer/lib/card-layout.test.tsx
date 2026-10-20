import { describe, expect, it } from 'vitest';
import { cardFieldSchema, type CardField } from '@shared/cards';
import {
  clampSpan,
  fieldGridStyle,
  moveFieldTo,
  snapHeight,
  spanFromPixels,
  updateFields,
} from '@renderer/lib/cards';

const field = (input: Record<string, unknown> & { id: string }): CardField =>
  cardFieldSchema.parse({ kind: 'text', ...input });

describe('card grid maths', () => {
  it('keeps a span whole and between 1 and 12', () => {
    expect(clampSpan(0)).toBe(1);
    expect(clampSpan(4.4)).toBe(4);
    expect(clampSpan(4.6)).toBe(5);
    expect(clampSpan(40)).toBe(12);
    expect(clampSpan(Number.NaN)).toBe(1);
  });

  it('turns a width in pixels into the nearest number of columns', () => {
    expect(spanFromPixels(300, 300, 0)).toBe(12);
    expect(spanFromPixels(150, 300, 0)).toBe(6);
    expect(spanFromPixels(160, 300, 0)).toBe(6);
    expect(spanFromPixels(10, 300, 0)).toBe(1);
    expect(spanFromPixels(500, 300, 0)).toBe(12);
    expect(spanFromPixels(146, 300, 8)).toBe(6);
    expect(spanFromPixels(100, 0, 8)).toBe(12);
  });

  it('snaps a height to 4 pixels and clears it below the minimum', () => {
    expect(snapHeight(101)).toBe(100);
    expect(snapHeight(103)).toBe(104);
    expect(snapHeight(103, false)).toBe(103);
    expect(snapHeight(10)).toBeNull();
    expect(snapHeight(9000)).toBe(2000);
  });

  it('places a field on the grid by span, new row and height', () => {
    expect(fieldGridStyle(field({ id: 'a', span: 6 }))).toEqual({ gridColumn: 'span 6' });
    expect(fieldGridStyle(field({ id: 'a', span: 4, newRow: true, height: 80 }))).toEqual({
      gridColumn: '1 / span 4',
      minHeight: 80,
    });
  });
});

describe('moving and editing fields', () => {
  const fields = [
    field({ id: 'a' }),
    field({ id: 'b' }),
    field({ id: 'c', zone: 'footer' }),
    field({ id: 'd' }),
  ];

  it('moves a field before another one and takes its zone', () => {
    expect(moveFieldTo(fields, 'd', { zone: 'body', beforeId: 'a' }).map((item) => item.id)).toEqual([
      'd',
      'a',
      'b',
      'c',
    ]);
    const moved = moveFieldTo(fields, 'a', { zone: 'footer', beforeId: 'c' });
    expect(moved.map((item) => `${item.id}:${item.zone}`)).toEqual([
      'b:body',
      'a:footer',
      'c:footer',
      'd:body',
    ]);
  });

  it('moves a field to the end of a zone', () => {
    const moved = moveFieldTo(fields, 'a', { zone: 'header', beforeId: null });
    expect(moved.map((item) => `${item.id}:${item.zone}`)).toEqual([
      'b:body',
      'c:footer',
      'd:body',
      'a:header',
    ]);
    expect(moveFieldTo(fields, 'missing', { zone: 'body', beforeId: null })).toBe(fields);
    expect(moveFieldTo(fields, 'a', { zone: 'body', beforeId: 'a' })).toBe(fields);
  });

  it('changes several fields at once and leaves the rest', () => {
    const next = updateFields(fields, ['a', 'c'], (item) => ({ ...item, span: 6 }));
    expect(next.map((item) => item.span)).toEqual([6, 12, 6, 12]);
    expect(next[1]).toBe(fields[1]);
  });
});
