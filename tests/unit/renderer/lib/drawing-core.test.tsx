import { describe, expect, it } from 'vitest';
import { brushSettingsSchema, type BrushSettings } from '@shared/brushes';
import {
  GRAIN_SIZE,
  MASK_CELLS,
  TILE,
  coordKey,
  createStroke,
  drawingData,
  grainAlpha,
  grainField,
  inRange,
  intersect,
  layerFrame,
  layerGeometry,
  levelKeys,
  lodLevel,
  maskBox,
  maskFromAlpha,
  maskHit,
  nodeBox,
  paintTip,
  parseCoord,
  quantiseDiameter,
  seededRandom,
  tileBox,
  tilesInBox,
  tipAlpha,
  tipBounds,
  tipKey,
  toRaster,
  visibleRange,
  type Dab,
  type Sample,
} from '@renderer/lib/drawing';

const brush = (patch: Partial<BrushSettings> = {}): BrushSettings => ({
  ...brushSettingsSchema.parse({}),
  ...patch,
});
const at = (x: number, y: number, pressure = 1): Sample => ({ x, y, pressure, tiltX: 0, tiltY: 0 });

function line(settings: BrushSettings, from: number, to: number, step = 5, scale = 1): Dab[] {
  const stroke = createStroke(settings, scale, 1);
  const dabs: Dab[] = [];
  for (let x = from; x <= to; x += step) dabs.push(...stroke.add(at(x, 0)));
  return [...dabs, ...stroke.finish()];
}

describe('drawing geometry', () => {
  const node = { x: 300, y: -50, width: 100, height: 40, data: { resolution: 2, offsetX: 300, offsetY: 50 } };

  it('reads layer data with defaults and maps board points into raster space', () => {
    expect(drawingData({ data: {} })).toEqual({ resolution: 2, offsetX: 0, offsetY: 0 });
    expect(drawingData({ data: { resolution: 'bad' } })).toEqual({ resolution: 2, offsetX: 0, offsetY: 0 });
    const frame = layerFrame(node);
    expect(frame).toEqual({ originX: 0, originY: -100, resolution: 2 });
    expect(toRaster({ x: 10, y: -90 }, frame)).toEqual({ x: 20, y: 20 });
    expect(nodeBox(node, frame)).toEqual({ x0: 600, y0: 100, x1: 800, y1: 180 });
  });

  it('lists tiles under a box, including negative coordinates', () => {
    expect(tilesInBox({ x0: -10, y0: 0, x1: 10, y1: TILE })).toEqual([
      { tx: -1, ty: 0 },
      { tx: 0, ty: 0 },
    ]);
    expect(coordKey(-1, 4)).toBe('-1:4');
    expect(parseCoord('-1:4')).toEqual({ tx: -1, ty: 4 });
  });

  it('picks a reduced level when zoomed out and a visible range with a margin', () => {
    expect(lodLevel(1, 2)).toBe(0);
    expect(lodLevel(0.25, 2)).toBe(1);
    expect(lodLevel(0.01, 2)).toBe(5);
    expect(lodLevel(0.0001, 2)).toBe(8);
    expect(lodLevel(0, 2)).toBe(0);
    const range = visibleRange(
      { x: 0, y: 0, zoom: 1 },
      { width: 512, height: 256 },
      layerFrame({ ...node, x: 0, y: 0, data: {} }),
    );
    expect(range).toEqual({ level: 0, x0: -1, y0: -1, x1: 3, y1: 2 });
    expect(inRange('3:2', range)).toBe(true);
    expect(inRange('4:0', range)).toBe(false);
    expect(levelKeys(['0:0', '1:1', '-1:0', '3:3'], 1).sort()).toEqual(['-1:0', '0:0', '1:1']);
  });

  it('builds coverage masks and measures painted bounds', () => {
    const pixels = new Uint8ClampedArray(TILE * TILE * 4);
    pixels[(20 * TILE + 40) * 4 + 3] = 255;
    pixels[(300 * TILE + 500) * 4 + 3] = 3;
    const mask = maskFromAlpha(pixels);
    expect(mask).toHaveLength(MASK_CELLS * MASK_CELLS);
    expect(mask.reduce((sum, cell) => sum + cell, 0)).toBe(1);
    expect(maskHit(mask, 40, 20)).toBe(true);
    expect(maskHit(mask, 500, 300)).toBe(false);
    expect(maskHit(mask, -1, 20)).toBe(false);
    expect(maskBox(mask, 1, 0)).toEqual({ x0: TILE + 32, y0: 16, x1: TILE + 48, y1: 32 });
    expect(maskBox(new Uint8Array(MASK_CELLS * MASK_CELLS), 0, 0)).toBeNull();
  });

  it('turns painted boxes into node geometry and keeps an empty layer in place', () => {
    const frame = { originX: 10, originY: 20, resolution: 2 };
    expect(
      layerGeometry(
        [
          { x0: 100, y0: 40, x1: 300, y1: 60 },
          { x0: 0, y0: 80, x1: 20, y1: 100 },
        ],
        frame,
        node,
      ),
    ).toEqual({ x: 10, y: 40, width: 150, height: 30, offsetX: 0, offsetY: 20 });
    expect(layerGeometry([], frame, { x: 50, y: 60 })).toEqual({
      x: 50,
      y: 60,
      width: 1,
      height: 1,
      offsetX: 40,
      offsetY: 40,
    });
    expect(intersect(tileBox(0, 0), { x0: 500, y0: 500, x1: 600, y1: 600 })).toEqual({
      x0: 500,
      y0: 500,
      x1: 512,
      y1: 512,
    });
    expect(intersect(tileBox(0, 0), tileBox(1, 0))).toBeNull();
  });
});

describe('brush strokes', () => {
  it('places one dab for a click and spaces dabs along a line', () => {
    const click = createStroke(brush({ size: 10 }), 1, 1);
    expect(click.add(at(5, 5))).toEqual([{ x: 5, y: 5, diameter: 10, angle: 0, roundness: 1, alpha: 1 }]);
    expect(click.finish()).toEqual([]);
    const dabs = line(brush({ size: 10, spacing: 0.5 }), 0, 100);
    expect(dabs.length).toBeGreaterThanOrEqual(19);
    expect(dabs.length).toBeLessThanOrEqual(21);
    const gaps = dabs.slice(1).map((dab, index) => dab.x - (dabs[index]?.x ?? 0));
    for (const gap of gaps) expect(gap).toBeCloseTo(5, 0);
    expect(dabs.at(-1)?.x).toBeGreaterThan(94);
  });

  it('scales the tip with the layer resolution and never collapses below a quarter pixel', () => {
    expect(line(brush({ size: 10 }), 0, 0, 5, 2)[0]?.diameter).toBe(20);
    expect(line(brush({ size: 0.5 }), 0, 0, 5, 0.25)[0]?.diameter).toBe(0.25);
  });

  it('smooths the path and catches up with the pen when the stroke ends', () => {
    const settings = brush({ size: 2, spacing: 0.5, smoothing: 1 });
    const stroke = createStroke(settings, 1, 1);
    const during = [at(0, 0), at(50, 0), at(100, 0)].flatMap((sample) => stroke.add(sample));
    expect(Math.max(...during.map((dab) => dab.x))).toBeLessThan(50);
    const end = stroke.finish();
    expect(end.at(-1)?.x).toBeGreaterThan(98);
  });

  it('applies seeded jitter, scatter, count and opacity', () => {
    const settings = brush({
      size: 10,
      flow: 0.5,
      count: 3,
      sizeJitter: { amount: 1, control: 'off' },
      opacityJitter: { amount: 1, control: 'off' },
      angleJitter: { amount: 1, control: 'off' },
      scatter: { amount: 2, control: 'off' },
    });
    const first = line(settings, 0, 50);
    expect(line(settings, 0, 50)).toEqual(first);
    expect(new Set(first.slice(0, 3).map((dab) => dab.x)).size).toBeGreaterThan(1);
    for (const dab of first) {
      expect(dab.diameter).toBeLessThanOrEqual(10);
      expect(dab.alpha).toBeLessThanOrEqual(0.5);
      expect(Math.abs(dab.y)).toBeLessThanOrEqual(10);
      expect(dab.angle).toBeGreaterThanOrEqual(0);
      expect(dab.angle).toBeLessThan(360);
    }
    expect(seededRandom(3)()).toBe(seededRandom(3)());
  });

  it('maps pen pressure and tilt when a dynamic is controlled by them', () => {
    const settings = brush({
      size: 10,
      minSize: 0.2,
      sizeJitter: { amount: 0, control: 'pressure' },
      opacityJitter: { amount: 0, control: 'pressure' },
      angleJitter: { amount: 0, control: 'tilt' },
    });
    const stroke = createStroke(settings, 1, 1);
    const [dab] = stroke.add({ x: 0, y: 0, pressure: 0.5, tiltX: 0, tiltY: 45 });
    expect(dab?.diameter).toBeCloseTo(6);
    expect(dab?.angle).toBeCloseTo(90);
    expect(dab?.alpha).toBeCloseTo(0.5);
    const tilted = createStroke({ ...settings, opacityJitter: { amount: 0, control: 'tilt' } }, 1, 1);
    expect(tilted.add({ x: 0, y: 0, pressure: 1, tiltX: 0, tiltY: 45 })[0]?.alpha).toBeCloseTo(0.5);
    expect(createStroke(settings, 1, 1).add({ x: 0, y: 0, pressure: 0, tiltX: 0, tiltY: 0 })).toEqual([]);
  });
});

describe('brush tips and grain', () => {
  it('shapes hard, soft and square tips', () => {
    expect(tipAlpha(0.5, 0, { tip: 'round', hardness: 1 })).toBe(1);
    expect(tipAlpha(1, 0, { tip: 'round', hardness: 1 })).toBe(0);
    expect(tipAlpha(0.5, 0, { tip: 'round', hardness: 0 })).toBeCloseTo(0.5);
    expect(tipAlpha(0.9, 0.9, { tip: 'square', hardness: 1 })).toBe(1);
    expect(tipAlpha(0.9, 0.9, { tip: 'round', hardness: 1 })).toBe(0);
  });

  it('quantises diameters and keys cached tips by shape and colour', () => {
    expect(quantiseDiameter(0.3)).toBe(1);
    expect(quantiseDiameter(7.2)).toBe(8);
    expect(quantiseDiameter(100)).toBeGreaterThan(95);
    expect(quantiseDiameter(100)).toBeLessThan(106);
    expect(tipBounds(10)).toBe(12);
    const shape = { tip: 'round' as const, hardness: 1, roundness: 1, angle: 0 };
    expect(tipKey(shape, 10, '#000000')).not.toBe(tipKey({ ...shape, angle: 90 }, 10, '#000000'));
    expect(tipKey(shape, 10, '#000000')).toBe(tipKey({ ...shape, angle: 360 }, 10, '#000000'));
  });

  it('paints a coloured tip with a solid centre and a clear corner', () => {
    const side = 12;
    const pixels = new Uint8ClampedArray(side * side * 4);
    paintTip(
      pixels,
      side,
      10,
      { tip: 'round', hardness: 1, roundness: 0.5, angle: 30 },
      { r: 10, g: 20, b: 30 },
    );
    const centre = (6 * side + 6) * 4;
    expect([...pixels.slice(centre, centre + 4)]).toEqual([10, 20, 30, 255]);
    expect(pixels[3]).toBe(0);
    const small = new Uint8ClampedArray(4 * 4 * 4);
    paintTip(small, 4, 2, { tip: 'round', hardness: 0.5, roundness: 1, angle: 0 }, { r: 0, g: 0, b: 0 });
    expect(small[(1 * 4 + 1) * 4 + 3]).toBeGreaterThan(0);
  });

  it('builds repeating grain and turns it into alpha by depth', () => {
    for (const kind of ['paper', 'rough'] as const) {
      const field = grainField(kind, 64);
      expect(field).toHaveLength(64 * 64);
      for (const value of field) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
    const field = grainField('paper');
    expect(field).toHaveLength(GRAIN_SIZE * GRAIN_SIZE);
    const flat = new Uint8ClampedArray(GRAIN_SIZE * GRAIN_SIZE * 4);
    grainAlpha(field, 0, flat);
    expect(flat[3]).toBe(255);
    const deep = new Uint8ClampedArray(GRAIN_SIZE * GRAIN_SIZE * 4);
    grainAlpha(field, 1, deep);
    expect(Math.min(...deep.filter((_, index) => index % 4 === 3))).toBeLessThan(128);
  });
});
