import { describe, expect, it } from 'vitest';
import { byPosition, firstKey, keyBetween, keysBetween } from '@shared/ordering';

describe('keyBetween', () => {
  it('produces keys that sort between their neighbours', () => {
    const first = firstKey();
    const after = keyBetween(first, null);
    const before = keyBetween(null, first);
    const middle = keyBetween(before, first);
    expect(before < middle && middle < first && first < after).toBe(true);
  });

  it('keeps working after many inserts at the same spot', () => {
    let left = 'a';
    const right = 'b';
    const seen = new Set<string>();
    for (let index = 0; index < 200; index += 1) {
      const key = keyBetween(left, right);
      expect(key > left && key < right).toBe(true);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      left = key;
    }
  });

  it('generates runs of keys and sorts by them', () => {
    const keys = keysBetween('a', 'b', 5);
    expect([...keys].sort()).toEqual(keys);
    const items = keys.map((position, index) => ({ position, index })).reverse();
    expect(items.sort(byPosition).map((item) => item.index)).toEqual([0, 1, 2, 3, 4]);
  });

  it('rejects keys that are out of order or end with zero', () => {
    expect(() => keyBetween('b', 'a')).toThrow(/out of order/);
    expect(() => keyBetween('a0', null)).toThrow(/end with 0/);
  });
});
