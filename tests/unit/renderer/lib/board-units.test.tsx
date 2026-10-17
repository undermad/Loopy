import { describe, expect, it } from 'vitest';
import { formatLength, fromUnits, gridLevels, gridStep, snapToStep, toUnits } from '@renderer/lib/board';

const metres = { unit: 'm' as const, unitScale: 100 };

describe('board units', () => {
  it('converts between canvas pixels and board units', () => {
    expect(toUnits(250, metres)).toBe(2.5);
    expect(fromUnits(2.5, metres)).toBe(250);
    expect(formatLength(250, metres)).toBe('2.5 m');
    expect(formatLength(-0.0001, metres)).toBe('0 m');
    expect(formatLength(33.3333, { unit: 'cm', unitScale: 10 }, 1)).toBe('3.3 cm');
  });

  it('picks a grid step that keeps lines at least twelve screen pixels apart', () => {
    expect(gridStep(metres, 1)).toBe(100);
    expect(gridStep(metres, 0.1)).toBe(1000);
    expect(gridStep(metres, 0.01)).toBe(10000);
    expect(gridStep(metres, 4)).toBe(10);
    expect(gridStep(metres, 0)).toBe(100);
    expect(gridStep({ unit: 'px', unitScale: 1 }, 1)).toBe(100);
  });

  it('builds three grid levels a decade apart that hand over smoothly across zoom', () => {
    const atUnit = gridLevels(metres, 1);
    expect(atUnit.map((level) => level.flowGap)).toEqual([100, 1000, 10000]);
    expect(atUnit.map((level) => level.gap)).toEqual([100, 1000, 10000]);
    expect(atUnit[0]?.width).toBeLessThan(atUnit[1]?.width ?? 0);
    expect(atUnit[1]?.width).toBeLessThan(atUnit[2]?.width ?? 0);
    for (const level of atUnit) {
      expect(level.opacity).toBeGreaterThanOrEqual(0);
      expect(level.opacity).toBeLessThanOrEqual(1);
    }
    const before = gridLevels(metres, 1.199);
    const after = gridLevels(metres, 1.2);
    expect(after[0]?.flowGap).toBe(10);
    expect(after[0]?.opacity).toBe(0);
    expect(after[1]?.flowGap).toBe(100);
    expect(after[1]?.width).toBeCloseTo(before[0]?.width ?? -1, 1);
    expect(after[1]?.opacity).toBeCloseTo(before[0]?.opacity ?? -1, 1);
    expect(after[2]?.width).toBeCloseTo(before[1]?.width ?? -1, 1);
    expect(gridLevels(metres, 0)[0]?.flowGap).toBe(100);
    expect(gridLevels(metres, 0.001).map((level) => level.flowGap)).toEqual([100000, 1000000, 10000000]);
    expect(gridLevels(metres, 20)[0]?.flowGap).toBe(1);
  });

  it('snaps values to a step and leaves them alone without one', () => {
    expect(snapToStep(149, 100)).toBe(100);
    expect(snapToStep(151, 100)).toBe(200);
    expect(snapToStep(151, 0)).toBe(151);
  });
});
