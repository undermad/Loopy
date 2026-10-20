import { describe, expect, it } from 'vitest';
import { cardFieldSchema } from '@shared/cards';

describe('card field layout', () => {
  it('takes any whole number of columns from 1 to 12', () => {
    for (const span of [1, 5, 7, 11, 12]) {
      expect(cardFieldSchema.parse({ id: 'a', kind: 'text', span }).span).toBe(span);
    }
    for (const span of [0, 13, 2.5]) {
      expect(() => cardFieldSchema.parse({ id: 'a', kind: 'text', span })).toThrow();
    }
  });

  it('gives a field an optional minimum height and a new row flag', () => {
    expect(cardFieldSchema.parse({ id: 'a', kind: 'text' })).toMatchObject({ height: null, newRow: false });
    expect(cardFieldSchema.parse({ id: 'a', kind: 'image', height: 120, newRow: true })).toMatchObject({
      height: 120,
      newRow: true,
    });
    expect(() => cardFieldSchema.parse({ id: 'a', kind: 'text', height: 4 })).toThrow();
    expect(() => cardFieldSchema.parse({ id: 'a', kind: 'text', height: 5000 })).toThrow();
  });
});
