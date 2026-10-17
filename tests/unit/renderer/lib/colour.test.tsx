import { describe, expect, it } from 'vitest';
import { HARMONIES } from '@shared/colours';
import {
  PALETTE_PRESETS,
  clusterPixels,
  colourDistance,
  contrastLevels,
  contrastRatio,
  deriveHarmony,
  extractGradient,
  extractPalette,
  formatHsl,
  formatRgb,
  fromWheelHue,
  gradientCss,
  harmonyColours,
  harmonyHueOffsets,
  hexToHsv,
  hexToRgb,
  hsvToHex,
  hueToHex,
  isHex,
  isLightColour,
  markersFor,
  mixHex,
  moveHarmonyColour,
  normaliseHex,
  randomBaseHex,
  randomHarmonyColours,
  readableTextColour,
  rgbToHex,
  sampleAt,
  searchPresets,
  syntheticPixels,
  toWheelHue,
} from '@renderer/lib/colour';

function near(a: string, b: string, tolerance = 12): boolean {
  return colourDistance(a, b) <= tolerance;
}

describe('colour conversions', () => {
  it('normalises hex strings and converts between spaces', () => {
    expect(normaliseHex('#ABC')).toBe('#aabbcc');
    expect(normaliseHex('abcdef')).toBe('#abcdef');
    expect(normaliseHex('nope')).toBeNull();
    expect(isHex('#123')).toBe(true);
    expect(isHex('#12345')).toBe(false);
    expect(hexToRgb('#ff8000')).toEqual({ r: 255, g: 128, b: 0 });
    expect(rgbToHex({ r: 255, g: 128, b: 0 })).toBe('#ff8000');
    expect(rgbToHex({ r: 300, g: -5, b: 12.4 })).toBe('#ff000c');
    const hsv = hexToHsv('#00ff00');
    expect(hsv.h).toBeCloseTo(120);
    expect(hsv.s).toBe(1);
    expect(hsv.v).toBe(1);
    expect(hsvToHex({ h: 240, s: 1, v: 1 })).toBe('#0000ff');
    expect(hsvToHex({ h: 360 + 60, s: 1, v: 1 })).toBe('#ffff00');
    expect(hexToHsv('#808080').s).toBe(0);
    expect(hexToHsv('#808080').v).toBeCloseTo(0.502, 2);
    expect(hueToHex(0)).toBe('#ff0000');
    expect(formatRgb('#ff8000')).toBe('rgb(255, 128, 0)');
    expect(formatHsl('#ff0000')).toBe('hsl(0, 100%, 50%)');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(colourDistance('#000000', '#0a0000')).toBe(10);
  });

  it('computes WCAG contrast and readable text colours', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
    const levels = contrastLevels('#767676', '#ffffff');
    expect(levels.aaNormal).toBe(true);
    expect(levels.aaLarge).toBe(true);
    expect(levels.aaaNormal).toBe(false);
    expect(levels.aaaLarge).toBe(true);
    expect(isLightColour('#ffffff')).toBe(true);
    expect(isLightColour('#000000')).toBe(false);
    expect(readableTextColour('#ffff00')).toBe('#1a1a1a');
    expect(readableTextColour('#000080')).toBe('#ffffff');
  });
});

describe('Adobe wheel', () => {
  it('maps hues onto the artistic wheel and back', () => {
    expect(toWheelHue(0)).toBe(0);
    expect(toWheelHue(60)).toBeCloseTo(121.8, 1);
    expect(toWheelHue(360)).toBe(0);
    for (const hue of [0, 12, 57, 100, 180, 245, 300, 359]) {
      expect(fromWheelHue(toWheelHue(hue))).toBeCloseTo(hue, 0);
    }
    expect(fromWheelHue(-10)).toBeCloseTo(fromWheelHue(350), 5);
  });

  it('reproduces Adobe palettes for every rule', () => {
    const adobe: Record<string, string[]> = {
      analogous: ['#186a59', '#196b3f', '#19606b', '#196b23', '#19466b'],
      complementary: ['#186a59', '#6b2f19', '#52ab99', '#c0836c', '#abebde'],
      splitComplementary: ['#186a59', '#6b3d19', '#6b2019', '#abebde', '#ebc7ab'],
      triad: ['#186a59', '#6b5819', '#67196b', '#6cc0af', '#ebdcab'],
      square: ['#186a59', '#6b6919', '#6b2f19', '#3a196b', '#6cc0af'],
      compound: ['#186a59', '#196b2c', '#6b4719', '#6b2f19', '#6cc0af'],
      shades: ['#186a59', '#10473c', '#36ebc6', '#2dc2a4', '#239981'],
      monochromatic: ['#186a59', '#183832', '#84d1c2', '#d4fff6', '#c4fff3'],
    };
    for (const [harmony, expected] of Object.entries(adobe)) {
      const ours = harmonyColours('#186a59', harmony as never);
      expect(ours).toHaveLength(5);
      ours.forEach((hex, index) => {
        expect(near(hex, expected[index] ?? ''), `${harmony} slot ${String(index)}: ${hex}`).toBe(true);
      });
    }
    const red = harmonyColours('#d73220', 'complementary');
    expect(near(red[1] ?? '', '#20d677')).toBe(true);
    expect(harmonyColours('#3366cc', 'custom')).toEqual(['#3366cc']);
    expect(harmonyHueOffsets('square')).toEqual([0, -90, 180, 90, 0]);
    expect(harmonyHueOffsets('custom')).toEqual([]);
    for (const harmony of HARMONIES) {
      if (harmony === 'custom') continue;
      const moved = harmonyColours('#3366cc', harmony, 2);
      expect(moved[2]).toBe('#3366cc');
      expect(moved.slice(3).concat(moved.slice(0, 2))).toEqual(harmonyColours('#3366cc', harmony).slice(1));
    }
  });

  it("rotates every colour when one handle moves and keeps the others' saturation", () => {
    const colours = harmonyColours('#d73220', 'analogous').map((hex, index) => ({
      id: String(index),
      name: '',
      hex,
    }));
    const palette = { harmony: 'analogous' as const, baseIndex: 0, colours };
    const moved = moveHarmonyColour(palette, 1, { h: 120, s: 1, v: 0.84 });
    expect(moved[1]?.hex).toBe(hsvToHex({ h: 120, s: 1, v: 0.84 }));
    const delta = toWheelHue(120) - toWheelHue(hexToHsv(colours[1]?.hex ?? '').h);
    const base = hexToHsv(colours[0]?.hex ?? '');
    expect(hexToHsv(moved[0]?.hex ?? '').h).toBeCloseTo(fromWheelHue(toWheelHue(base.h) + delta), 0);
    expect(hexToHsv(moved[0]?.hex ?? '').s).toBeCloseTo(base.s, 1);
    expect(
      toWheelHue(hexToHsv(moved[2]?.hex ?? '').h) - toWheelHue(hexToHsv(moved[0]?.hex ?? '').h),
    ).toBeCloseTo(18, 0);
    expect(moveHarmonyColour(palette, 9, { h: 0, s: 1, v: 1 })).toBe(colours);

    const custom = moveHarmonyColour({ ...palette, harmony: 'custom' }, 1, { h: 200, s: 0.5, v: 0.5 });
    expect(custom[0]?.hex).toBe(colours[0]?.hex);
    expect(custom[1]?.hex).toBe(hsvToHex({ h: 200, s: 0.5, v: 0.5 }));
  });

  it('derives a palette from its base and keeps ids', () => {
    const colours = ['#111111', '#222222', '#333333'].map((hex, index) => ({
      id: String(index),
      name: 'n',
      hex,
    }));
    const derived = deriveHarmony({ harmony: 'triad', baseIndex: 0, colours }, '#ff0000');
    expect(derived).toHaveLength(5);
    expect(derived[0]).toMatchObject({ id: '0', name: 'n', hex: '#ff0000' });
    expect(derived[4]?.id).toHaveLength(36);
    expect(deriveHarmony({ harmony: 'custom', baseIndex: 1, colours }, '#abcdef')[1]?.hex).toBe('#abcdef');
    expect(deriveHarmony({ harmony: 'custom', baseIndex: 1, colours })).toEqual(colours);
    expect(deriveHarmony({ harmony: 'triad', baseIndex: 0, colours: [] })).toEqual([]);
  });

  it('generates random palettes from a seeded source', () => {
    let seed = 0.1;
    const random = () => {
      seed = (seed + 0.37) % 1;
      return seed;
    };
    expect(randomBaseHex(random)).toMatch(/^#[0-9a-f]{6}$/);
    expect(randomHarmonyColours('triad', 0, random)).toHaveLength(5);
    const custom = randomHarmonyColours('custom', 0, random);
    expect(custom).toHaveLength(5);
    expect(new Set(custom).size).toBeGreaterThan(1);
    expect(randomHarmonyColours('shades')).toHaveLength(5);
  });
});

describe('image extraction', () => {
  const pixels = syntheticPixels(['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#101010', '#808080'], 24, 24);

  it('clusters pixels and picks colours for each mood', () => {
    const clusters = clusterPixels(pixels, 8);
    expect(clusters.length).toBeGreaterThan(3);
    expect(clusters.reduce((sum, cluster) => sum + cluster.weight, 0)).toBeCloseTo(1, 5);
    const colourful = extractPalette(pixels, 'colourful', 3);
    expect(colourful).toHaveLength(3);
    expect(colourful.every((hex) => /^#[0-9a-f]{6}$/.test(hex))).toBe(true);
    expect(extractPalette(pixels, 'dark', 2)[0]).toBe('#101010');
    expect(hexToHsv(extractPalette(pixels, 'bright', 1)[0] ?? '').v).toBeCloseTo(1, 1);
    expect(extractPalette(pixels, 'muted', 5)).toHaveLength(5);
    expect(extractPalette(pixels, 'deep', 5)).toHaveLength(5);
    expect(extractPalette({ data: new Uint8ClampedArray(0), width: 0, height: 0 }, 'colourful')).toEqual([]);
    const transparent = syntheticPixels(['#ff0000'], 2, 2);
    transparent.data[3] = 0;
    expect(clusterPixels(transparent).length).toBe(1);
  });

  it('builds gradients, samples pixels and places markers', () => {
    const gradient = extractGradient(pixels, 4);
    expect(gradient).toHaveLength(4);
    expect(gradient[0]).toBe('#101010');
    expect(extractGradient({ data: new Uint8ClampedArray(0), width: 0, height: 0 }, 3)).toEqual([]);
    expect(gradientCss(['#000000', '#ffffff'])).toBe('linear-gradient(90deg, #000000 0%, #ffffff 100%)');
    expect(gradientCss(['#123456'])).toBe('#123456');
    expect(gradientCss([])).toBe('transparent');
    expect(sampleAt(pixels, 0, 0)).toBe('#ff0000');
    expect(sampleAt(pixels, 1, 0)).toBe('#00ff00');
    expect(sampleAt(pixels, -5, 999)).toMatch(/^#/);
    const markers = markersFor(pixels, ['#ff0000', '#0000ff']);
    expect(markers).toHaveLength(2);
    expect(markers[0]).toEqual({ x: 0, y: 0 });
    expect(markers[1]?.x).toBeGreaterThan(0);
  });
});

describe('presets', () => {
  it('ships valid presets and searches them by name, tag and harmony', () => {
    expect(PALETTE_PRESETS.length).toBeGreaterThan(10);
    for (const preset of PALETTE_PRESETS) {
      expect(preset.colours).toHaveLength(5);
      expect(preset.colours.every((hex) => /^#[0-9a-f]{6}$/.test(hex))).toBe(true);
    }
    expect(new Set(PALETTE_PRESETS.map((preset) => preset.id)).size).toBe(PALETTE_PRESETS.length);
    expect(searchPresets('')).toHaveLength(PALETTE_PRESETS.length);
    expect(searchPresets('sunset').map((preset) => preset.id)).toEqual(['sunset-drive']);
    expect(searchPresets('pixel').length).toBeGreaterThan(1);
    expect(searchPresets('shades').every((preset) => preset.harmony === 'shades')).toBe(true);
    expect(searchPresets('zzz')).toEqual([]);
  });
});
