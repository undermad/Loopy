import { HARMONY_COLOUR_COUNT, type Harmony, type Palette, type PaletteColour } from '@shared/colours';
import { hexToHsv, hsvToHex, type Hsv } from './convert';

const WHEEL_STEP = 15;
const WHEEL_TABLE = [
  0, 25.7, 51.2, 84.6, 121.8, 133.2, 143.2, 154.4, 165.5, 178, 191.7, 204.7, 218.3, 231.7, 246.8, 260.6,
  274.6, 289, 302.5, 316.8, 329.5, 339.4, 346, 352.3, 360,
];

function wrap(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

export function toWheelHue(hue: number): number {
  const h = wrap(hue);
  const index = Math.min(WHEEL_TABLE.length - 2, Math.floor(h / WHEEL_STEP));
  const t = (h - index * WHEEL_STEP) / WHEEL_STEP;
  const from = WHEEL_TABLE[index] ?? 0;
  const to = WHEEL_TABLE[index + 1] ?? 360;
  return from + (to - from) * t;
}

export function fromWheelHue(wheel: number): number {
  const w = wrap(wheel);
  let index = 0;
  while (index < WHEEL_TABLE.length - 2 && (WHEEL_TABLE[index + 1] ?? 360) < w) index += 1;
  const from = WHEEL_TABLE[index] ?? 0;
  const to = WHEEL_TABLE[index + 1] ?? 360;
  const t = to === from ? 0 : (w - from) / (to - from);
  return wrap((index + t) * WHEEL_STEP);
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function lowerSaturation(s: number, step: number): number {
  const next = s - step;
  return next < 0.1 ? clamp(step - s + 0.2) : next;
}

function lowerValue(v: number, step: number): number {
  const next = v - step;
  if (next >= 0.2) return next;
  const raised = v + step;
  return raised > 1.3 ? 0.2 : clamp(raised);
}

function shadeValue(v: number, step: number): number {
  const next = v - step;
  return next < 0.2 ? clamp(next + 0.8) : next;
}

interface Slot {
  hue: number;
  s?: (s: number) => number;
  v?: (v: number) => number;
}

const same = { hue: 0 };

const RULES: Record<Exclude<Harmony, 'custom'>, Slot[]> = {
  analogous: [same, { hue: -18 }, { hue: 18 }, { hue: -36 }, { hue: 36 }],
  monochromatic: [
    same,
    { hue: 0, s: (s) => lowerSaturation(s, 0.2), v: (v) => lowerValue(v, 0.2) },
    { hue: 0, s: (s) => lowerSaturation(s, 0.4), v: (v) => lowerValue(v, 0.4) },
    { hue: 0, s: (s) => lowerSaturation(s, 0.6), v: (v) => lowerValue(v, 0.6) },
    { hue: 0, s: (s) => lowerSaturation(s, 0.8), v: (v) => lowerValue(v, 0.6) },
  ],
  triad: [
    same,
    { hue: -120 },
    { hue: 120 },
    { hue: 0, s: (s) => lowerSaturation(s, 0.34), v: (v) => lowerValue(v, 0.33) },
    { hue: -120, s: (s) => lowerSaturation(s, 0.5), v: (v) => lowerValue(v, 0.5) },
  ],
  complementary: [
    same,
    { hue: 180 },
    { hue: 0, s: (s) => lowerSaturation(s, 0.25), v: (v) => lowerValue(v, 0.25) },
    { hue: 180, s: (s) => lowerSaturation(s, 0.34), v: (v) => lowerValue(v, 0.33) },
    { hue: 0, s: (s) => lowerSaturation(s, 0.5), v: (v) => lowerValue(v, 0.5) },
  ],
  splitComplementary: [
    same,
    { hue: -162 },
    { hue: 162 },
    { hue: 0, s: (s) => lowerSaturation(s, 0.5), v: (v) => lowerValue(v, 0.5) },
    { hue: -162, s: (s) => lowerSaturation(s, 0.5), v: (v) => lowerValue(v, 0.5) },
  ],
  square: [
    same,
    { hue: -90 },
    { hue: 180 },
    { hue: 90 },
    { hue: 0, s: (s) => lowerSaturation(s, 0.34), v: (v) => lowerValue(v, 0.33) },
  ],
  compound: [
    same,
    { hue: -30 },
    { hue: -150 },
    { hue: 180 },
    { hue: 0, s: (s) => lowerSaturation(s, 0.34), v: (v) => lowerValue(v, 0.33) },
  ],
  shades: [
    same,
    { hue: 0, v: (v) => shadeValue(v, 0.14) },
    { hue: 0, v: (v) => shadeValue(v, 0.3) },
    { hue: 0, v: (v) => shadeValue(v, 0.46) },
    { hue: 0, v: (v) => shadeValue(v, 0.62) },
  ],
};

export function harmonyHueOffsets(harmony: Harmony): number[] {
  return harmony === 'custom' ? [] : RULES[harmony].map((slot) => slot.hue);
}

function shiftHue(hue: number, offset: number): number {
  return fromWheelHue(toWheelHue(hue) + offset);
}

function rotate<T>(items: T[], offset: number): T[] {
  const length = items.length;
  if (length === 0) return items;
  const shiftBy = ((offset % length) + length) % length;
  return items.map((_, index) => items[(index - shiftBy + length) % length] as T);
}

export function harmonyColours(baseHex: string, harmony: Harmony, baseIndex = 0): string[] {
  if (harmony === 'custom') return [baseHex];
  const base = hexToHsv(baseHex);
  const colours = RULES[harmony].map((slot) =>
    hsvToHex({
      h: shiftHue(base.h, slot.hue),
      s: slot.s ? slot.s(base.s) : base.s,
      v: slot.v ? slot.v(base.v) : base.v,
    }),
  );
  return rotate(colours, clamp(Math.round(baseIndex), 0, HARMONY_COLOUR_COUNT - 1));
}

export type HarmonyPalette = Pick<Palette, 'harmony' | 'baseIndex' | 'colours'>;

export function deriveHarmony(palette: HarmonyPalette, baseHex?: string): PaletteColour[] {
  const base = baseHex ?? palette.colours[palette.baseIndex]?.hex ?? palette.colours[0]?.hex;
  if (!base) return palette.colours;
  if (palette.harmony === 'custom') {
    return palette.colours.map((colour, index) =>
      index === palette.baseIndex ? { ...colour, hex: base } : colour,
    );
  }
  return harmonyColours(base, palette.harmony, palette.baseIndex).map((hex, index) => {
    const existing = palette.colours[index];
    return existing ? { ...existing, hex } : { id: crypto.randomUUID(), name: '', hex };
  });
}

export function moveHarmonyColour(
  palette: HarmonyPalette,
  index: number,
  next: Hsv,
  origin: Hsv[] = palette.colours.map((colour) => hexToHsv(colour.hex)),
): PaletteColour[] {
  const moved = palette.colours[index];
  const start = origin[index];
  if (!moved || !start) return palette.colours;
  if (palette.harmony === 'custom') {
    return palette.colours.map((colour, position) =>
      position === index ? { ...colour, hex: hsvToHex(next) } : colour,
    );
  }
  if (index === palette.baseIndex) return deriveHarmony(palette, hsvToHex(next));
  const delta = toWheelHue(next.h) - toWheelHue(start.h);
  return palette.colours.map((colour, position) => {
    if (position === index) return { ...colour, hex: hsvToHex(next) };
    const hsv = origin[position] ?? hexToHsv(colour.hex);
    return { ...colour, hex: hsvToHex({ ...hsv, h: shiftHue(hsv.h, delta) }) };
  });
}

export type Random = () => number;

export function randomBaseHex(random: Random = Math.random): string {
  return hsvToHex({ h: random() * 360, s: 0.45 + random() * 0.55, v: 0.55 + random() * 0.45 });
}

export function randomHarmonyColours(
  harmony: Harmony,
  baseIndex = 0,
  random: Random = Math.random,
): string[] {
  if (harmony === 'custom') {
    return Array.from({ length: HARMONY_COLOUR_COUNT }, () => randomBaseHex(random));
  }
  return harmonyColours(randomBaseHex(random), harmony, baseIndex);
}
