import { describe, expect, it } from 'vitest';
import { formatLength, fromUnits, gridStep, snapToStep, toUnits } from '@renderer/lib/board';

const metres = { unit: 'm' as const, unitScale: 100 };

describe('board units', () => {
  it('converts between canvas pixels and board units', () => {
    expect(toUnits(250, metres)).toBe(2.5);
    expect(fromUnits(2.5, metres)).toBe(250);
    expect(formatLength(250, metres)).toBe('2.5 m');
    expect(formatLength(-0.0001, metres)).toBe('0 m');
    expect(formatLength(33.3333, { unit: 'cm', unitScale: 10 }, 1)).toBe('3.3 cm');
  });

  it('picks a grid step that keeps dots at least sixteen screen pixels apart', () => {
    expect(gridStep(metres, 1)).toBe(100);
    expect(gridStep(metres, 0.1)).toBe(1000);
    expect(gridStep(metres, 0.01)).toBe(10000);
    expect(gridStep(metres, 4)).toBe(10);
    expect(gridStep(metres, 0)).toBe(100);
    expect(gridStep({ unit: 'px', unitScale: 1 }, 1)).toBe(100);
  });

  it('snaps values to a step and leaves them alone without one', () => {
    expect(snapToStep(149, 100)).toBe(100);
    expect(snapToStep(151, 100)).toBe(200);
    expect(snapToStep(151, 0)).toBe(151);
  });
});
