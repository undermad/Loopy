import { describe, expect, it } from 'vitest';
import {
  clusterMember,
  clusterOffsets,
  dominantHue,
  harmonyColours,
  hexToHsv,
  hsvToHex,
  hueFamily,
  hueOffsetBetween,
  matchLuminance,
  relativeLuminance,
  toWheelHue,
  type ClusterRules,
} from '@renderer/lib/colour';

const fire = harmonyColours('#e2361b', 'monochromatic');
const seed = { harmony: 'monochromatic' as const, baseIndex: 0, colours: fire.map((hex) => ({ hex })) };
const rules: ClusterRules = { scheme: 'auto', count: 1, structure: 'keep', balance: 0 };

function wheelDistance(a: string, b: string): number {
  const d = Math.abs(toWheelHue(hexToHsv(a).h) - toWheelHue(hexToHsv(b).h)) % 360;
  return Math.min(d, 360 - d);
}

function firstLuminance(hexes: string[]): number {
  return relativeLuminance(hexes[0] ?? '#000000');
}

describe('clusterOffsets', () => {
  it('places hues by scheme and picks the classic scheme for the count automatically', () => {
    expect(clusterOffsets('auto', 1)).toEqual([180]);
    expect(clusterOffsets('auto', 2)).toEqual([120, 240]);
    expect(clusterOffsets('auto', 3)).toEqual([90, 180, 270]);
    expect(clusterOffsets('auto', 5)).toEqual([60, 120, 180, 240, 300]);
    expect(clusterOffsets('splitComplementary', 2)).toEqual([150, 210]);
    expect(clusterOffsets('analogous', 3)).toEqual([30, 330, 60]);
    expect(clusterOffsets('complementary', 0)).toEqual([]);
  });

  it('fills the widest gaps once a scheme runs out of anchors or the cluster already has hues', () => {
    expect(clusterOffsets('triad', 3)).toEqual([120, 240, 60]);
    expect(clusterOffsets('gaps', 2, [180])).toEqual([90, 270]);
    expect(clusterOffsets('triad', 2, [120])).toEqual([240, 60]);
    expect(clusterOffsets('even', 1, [90, 180, 270])).toEqual([45]);
  });
});

describe('dominantHue and hueFamily', () => {
  it('finds the weighted hue and tells chromatic palettes from greys', () => {
    expect(hueFamily(dominantHue(fire).hue)).toBe('red');
    expect(dominantHue(['#808080', '#202020']).chromatic).toBe(false);
    expect(hueFamily(220)).toBe('blue');
    expect(hueFamily(120, 0.05)).toBe('grey');
    expect(Math.round(hueOffsetBetween(fire, fire))).toBe(0);
  });
});

describe('matchLuminance', () => {
  it('reaches a target by changing brightness, and saturation when brightness is not enough', () => {
    const darker = matchLuminance(hexToHsv('#ffee00'), 0.1);
    expect(Math.abs(relativeLuminance(hsvToHex(darker)) - 0.1)).toBeLessThan(0.01);
    const lighter = matchLuminance(hexToHsv('#2200ff'), 0.6);
    expect(lighter.v).toBe(1);
    expect(lighter.s).toBeLessThan(1);
    expect(Math.abs(relativeLuminance(hsvToHex(lighter)) - 0.6)).toBeLessThan(0.01);
  });
});

describe('clusterMember', () => {
  it('keeps the seed structure, turns every colour by the offset and names the result', () => {
    const member = clusterMember(seed, 180, rules);
    expect(member.harmony).toBe('monochromatic');
    expect(member.hexes).toHaveLength(fire.length);
    member.hexes.forEach((hex, index) => {
      const original = fire[index] ?? '#000000';
      expect(hexToHsv(hex).s).toBeCloseTo(hexToHsv(original).s, 1);
      expect(hexToHsv(hex).v).toBeCloseTo(hexToHsv(original).v, 1);
      expect(wheelDistance(hex, original)).toBeGreaterThan(170);
    });
    expect(member.family).toBe('green');
    expect(member.offset).toBe(180);
  });

  it('balances lightness towards the seed by the requested amount', () => {
    const unbalanced = clusterMember(seed, 90, rules);
    const balanced = clusterMember(seed, 90, { ...rules, balance: 1 });
    const half = clusterMember(seed, 90, { ...rules, balance: 0.5 });
    expect(Math.abs(firstLuminance(balanced.hexes) - firstLuminance(fire))).toBeLessThan(0.01);
    expect(firstLuminance(half.hexes)).toBeLessThan(firstLuminance(unbalanced.hexes));
    expect(firstLuminance(half.hexes)).toBeGreaterThan(firstLuminance(balanced.hexes));
  });

  it('builds a harmony from the turned base colour and tints a grey seed', () => {
    const triad = clusterMember(seed, 120, { ...rules, structure: 'triad' });
    expect(triad.harmony).toBe('triad');
    expect(triad.hexes).toHaveLength(5);
    expect(triad.family).toBe(hueFamily(hexToHsv(triad.hexes[triad.baseIndex] ?? '#000000').h));
    expect(triad.family).not.toBe('red');
    const grey = clusterMember(
      { harmony: 'shades', baseIndex: 0, colours: [{ hex: '#808080' }, { hex: '#404040' }] },
      240,
      rules,
    );
    expect(hexToHsv(grey.hexes[0] ?? '#000000').s).toBeGreaterThan(0.4);
    expect(grey.family).not.toBe('grey');
  });
});
