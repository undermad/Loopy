import { HARMONY_COLOUR_COUNT, type Harmony } from '@shared/colours';
import { hexToHsv, hsvToHex, relativeLuminance, type Hsv } from './convert';
import { fromWheelHue, harmonyColours, toWheelHue } from './harmony';

export const CLUSTER_SCHEMES = [
  'auto',
  'complementary',
  'splitComplementary',
  'triad',
  'square',
  'analogous',
  'even',
  'gaps',
] as const;

export type ClusterScheme = (typeof CLUSTER_SCHEMES)[number];

export type ClusterStructure = 'keep' | Exclude<Harmony, 'custom'>;

export interface ClusterRules {
  scheme: ClusterScheme;
  count: number;
  structure: ClusterStructure;
  balance: number;
}

export interface ClusterSeed {
  harmony: Harmony;
  baseIndex: number;
  colours: { hex: string }[];
}

export interface ClusterMember {
  offset: number;
  harmony: Harmony;
  baseIndex: number;
  hexes: string[];
  family: HueFamily;
}

export const HUE_FAMILIES = [
  'red',
  'orange',
  'yellow',
  'lime',
  'green',
  'teal',
  'blue',
  'purple',
  'magenta',
  'pink',
  'grey',
] as const;

export type HueFamily = (typeof HUE_FAMILIES)[number];

const ANCHORS: Record<Exclude<ClusterScheme, 'auto' | 'even' | 'gaps'>, number[]> = {
  complementary: [180],
  splitComplementary: [150, 210],
  triad: [120, 240],
  square: [90, 180, 270],
  analogous: [30, 330, 60, 300, 90, 270],
};

const CLASH_DEGREES = 20;
const CHROMA_THRESHOLD = 0.08;
const GREY_SATURATION = 0.12;
const TINT_SATURATION = 0.45;

function wrap(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function distance(a: number, b: number): number {
  const d = Math.abs(wrap(a) - wrap(b));
  return Math.min(d, 360 - d);
}

function largestGapMidpoint(occupied: number[]): number {
  const sorted = [...new Set(occupied.map(wrap))].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  let best = { size: -1, mid: 0 };
  sorted.forEach((start, index) => {
    const end = index === sorted.length - 1 ? (sorted[0] ?? 0) + 360 : (sorted[index + 1] ?? start);
    const size = end - start;
    if (size > best.size) best = { size, mid: wrap(start + size / 2) };
  });
  return best.mid;
}

function fillGaps(occupied: number[], count: number): number[] {
  const taken = [...occupied];
  const added: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const next = Math.round(largestGapMidpoint(taken));
    taken.push(next);
    added.push(next);
  }
  return added;
}

function autoScheme(count: number): Exclude<ClusterScheme, 'auto'> {
  if (count === 1) return 'complementary';
  if (count === 2) return 'triad';
  if (count === 3) return 'square';
  return 'even';
}

export function clusterOffsets(scheme: ClusterScheme, count: number, existing: number[] = []): number[] {
  const wanted = Math.max(0, Math.round(count));
  if (wanted === 0) return [];
  const occupied = [0, ...existing.map(wrap)];
  const resolved = scheme === 'auto' ? autoScheme(wanted + existing.length) : scheme;
  if (resolved === 'gaps' || (resolved === 'even' && existing.length > 0)) return fillGaps(occupied, wanted);
  if (resolved === 'even') {
    return Array.from({ length: wanted }, (_, index) => Math.round(((index + 1) * 360) / (wanted + 1)));
  }
  const picked = ANCHORS[resolved]
    .filter((anchor) => occupied.every((taken) => distance(anchor, taken) >= CLASH_DEGREES))
    .slice(0, wanted);
  return [...picked, ...fillGaps([...occupied, ...picked], wanted - picked.length)];
}

function weightOf(hsv: Hsv): number {
  return hsv.s * hsv.v;
}

export function dominantHue(hexes: string[]): { hue: number; chromatic: boolean } {
  let x = 0;
  let y = 0;
  let total = 0;
  for (const hex of hexes) {
    const hsv = hexToHsv(hex);
    const weight = weightOf(hsv);
    const angle = (toWheelHue(hsv.h) * Math.PI) / 180;
    x += Math.cos(angle) * weight;
    y += Math.sin(angle) * weight;
    total += weight;
  }
  const chromatic = hexes.length > 0 && total / hexes.length >= CHROMA_THRESHOLD;
  const wheel = chromatic ? wrap((Math.atan2(y, x) * 180) / Math.PI) : 0;
  return { hue: fromWheelHue(wheel), chromatic };
}

export function hueOffsetBetween(from: string[], to: string[]): number {
  return wrap(toWheelHue(dominantHue(to).hue) - toWheelHue(dominantHue(from).hue));
}

export function hueFamily(hue: number, saturation = 1): HueFamily {
  if (saturation < GREY_SATURATION) return 'grey';
  const h = wrap(hue);
  if (h < 12 || h >= 352) return 'red';
  if (h < 40) return 'orange';
  if (h < 66) return 'yellow';
  if (h < 95) return 'lime';
  if (h < 155) return 'green';
  if (h < 195) return 'teal';
  if (h < 255) return 'blue';
  if (h < 290) return 'purple';
  if (h < 330) return 'magenta';
  return 'pink';
}

function paletteFamily(hexes: string[]): HueFamily {
  const { hue, chromatic } = dominantHue(hexes);
  return chromatic ? hueFamily(hue) : 'grey';
}

const SEARCH_STEPS = 24;

export function matchLuminance(hsv: Hsv, target: number): Hsv {
  const luminance = (candidate: Hsv) => relativeLuminance(hsvToHex(candidate));
  if (luminance({ ...hsv, v: 1 }) >= target) {
    let low = 0;
    let high = 1;
    for (let step = 0; step < SEARCH_STEPS; step += 1) {
      const mid = (low + high) / 2;
      if (luminance({ ...hsv, v: mid }) < target) low = mid;
      else high = mid;
    }
    return { ...hsv, v: high };
  }
  let low = 0;
  let high = hsv.s;
  for (let step = 0; step < SEARCH_STEPS; step += 1) {
    const mid = (low + high) / 2;
    if (luminance({ h: hsv.h, s: mid, v: 1 }) >= target) low = mid;
    else high = mid;
  }
  return { h: hsv.h, s: low, v: 1 };
}

function rotate(hsv: Hsv, offset: number, chromatic: boolean): Hsv {
  if (!chromatic) return { h: fromWheelHue(offset), s: Math.max(hsv.s, TINT_SATURATION), v: hsv.v };
  return { ...hsv, h: fromWheelHue(toWheelHue(hsv.h) + offset) };
}

function balancedTarget(current: number, original: number, balance: number): number {
  const amount = Math.min(1, Math.max(0, balance));
  const lightness = Math.cbrt(current) + (Math.cbrt(original) - Math.cbrt(current)) * amount;
  return lightness ** 3;
}

function finish(hsv: Hsv, original: string, balance: number): string {
  if (balance <= 0) return hsvToHex(hsv);
  const target = balancedTarget(relativeLuminance(hsvToHex(hsv)), relativeLuminance(original), balance);
  return hsvToHex(matchLuminance(hsv, target));
}

export function clusterMember(seed: ClusterSeed, offset: number, rules: ClusterRules): ClusterMember {
  const seedHexes = seed.colours.map((colour) => colour.hex);
  const { chromatic } = dominantHue(seedHexes);
  const baseIndex = Math.min(Math.max(0, seed.baseIndex), seedHexes.length - 1);
  if (rules.structure === 'keep') {
    const hexes = seedHexes.map((hex) =>
      finish(rotate(hexToHsv(hex), offset, chromatic), hex, rules.balance),
    );
    return { offset: wrap(offset), harmony: seed.harmony, baseIndex, hexes, family: paletteFamily(hexes) };
  }
  const seedBase = seedHexes[baseIndex] ?? '#808080';
  const memberBaseIndex = Math.min(baseIndex, HARMONY_COLOUR_COUNT - 1);
  const rotatedBase = hsvToHex(rotate(hexToHsv(seedBase), offset, chromatic));
  const hexes = harmonyColours(rotatedBase, rules.structure, memberBaseIndex).map((hex, index) => {
    return finish(hexToHsv(hex), seedHexes[index] ?? seedBase, rules.balance);
  });
  const base = hexes[memberBaseIndex] ?? rotatedBase;
  const baseHsv = hexToHsv(base);
  return {
    offset: wrap(offset),
    harmony: rules.structure,
    baseIndex: memberBaseIndex,
    hexes,
    family: hueFamily(baseHsv.h, chromatic ? baseHsv.s : 0),
  };
}
