import type { BrushGrain, BrushSettings } from '@shared/brushes';
import { hexToRgb } from '@renderer/lib/colour';
import { claimTile, context2d, createTileCanvas, changed, releaseTile, tileEntry } from './cache';
import { TILE, coordKey, tilesInBox, type Box } from './geometry';
import { GRAIN_SIZE, grainAlpha, grainField } from './grain';
import type { Dab } from './stroke';
import { paintTip, quantiseDiameter, tipBounds, tipKey } from './tip';

export type PaintMode = 'brush' | 'eraser';

interface Touched {
  coord: string;
  tx: number;
  ty: number;
  wet: OffscreenCanvas;
  original: OffscreenCanvas | null;
  ready: boolean;
  dirty: Box | null;
}

const MAX_TIPS = 96;
const tips = new Map<string, OffscreenCanvas>();
const grains = new Map<string, OffscreenCanvas>();
let scratch: OffscreenCanvas | null = null;

function tipCanvas(dab: Dab, settings: BrushSettings, colour: string, diameter: number): OffscreenCanvas {
  const shape = {
    tip: settings.tip,
    hardness: settings.hardness,
    roundness: dab.roundness,
    angle: dab.angle,
  };
  const key = tipKey(shape, diameter, colour);
  const cached = tips.get(key);
  if (cached) {
    tips.delete(key);
    tips.set(key, cached);
    return cached;
  }
  const side = tipBounds(diameter);
  const canvas = createTileCanvas(side, side);
  const drawing = context2d(canvas);
  const image = drawing.createImageData(side, side);
  paintTip(image.data, side, diameter, shape, hexToRgb(colour));
  drawing.putImageData(image, 0, 0);
  tips.set(key, canvas);
  if (tips.size > MAX_TIPS) {
    const oldest = tips.keys().next().value;
    if (oldest !== undefined) tips.delete(oldest);
  }
  return canvas;
}

function grainCanvas(kind: Exclude<BrushGrain, 'none'>, depth: number): OffscreenCanvas {
  const key = `${kind}:${String(Math.round(depth * 20))}`;
  const cached = grains.get(key);
  if (cached) return cached;
  const canvas = createTileCanvas(GRAIN_SIZE, GRAIN_SIZE);
  const drawing = context2d(canvas);
  const image = drawing.createImageData(GRAIN_SIZE, GRAIN_SIZE);
  grainAlpha(grainField(kind), depth, image.data);
  drawing.putImageData(image, 0, 0);
  grains.set(key, canvas);
  return canvas;
}

interface Stamp {
  tip: OffscreenCanvas;
  alpha: number;
  side: number;
  box: Box;
}

function stampFor(dab: Dab, settings: BrushSettings, colour: string, mode: PaintMode): Stamp {
  const exact = Math.max(1, dab.diameter);
  const alpha = dab.diameter < 1 ? dab.alpha * dab.diameter * dab.diameter : dab.alpha;
  const diameter = quantiseDiameter(exact);
  const tip = tipCanvas(dab, settings, mode === 'eraser' ? '#000000' : colour, diameter);
  const side = tip.width * (exact / diameter);
  const box = { x0: dab.x - side / 2, y0: dab.y - side / 2, x1: dab.x + side / 2, y1: dab.y + side / 2 };
  return { tip, alpha: Math.min(1, alpha), side, box };
}

export function grainPattern(
  drawing: OffscreenCanvasRenderingContext2D,
  settings: BrushSettings,
  scale: number,
  offset: { x: number; y: number },
): CanvasPattern | null {
  if (settings.grain === 'none') return null;
  const pattern = drawing.createPattern(grainCanvas(settings.grain, settings.grainDepth), 'repeat');
  pattern?.setTransform(new DOMMatrix([scale, 0, 0, scale, offset.x, offset.y]));
  return pattern;
}

export function stampDabs(
  target: OffscreenCanvasRenderingContext2D,
  dabs: Dab[],
  settings: BrushSettings,
  colour: string,
  mode: PaintMode,
): void {
  for (const dab of dabs) {
    const stamp = stampFor(dab, settings, colour, mode);
    target.globalAlpha = stamp.alpha;
    target.drawImage(stamp.tip, stamp.box.x0, stamp.box.y0, stamp.side, stamp.side);
  }
  target.globalAlpha = 1;
}

function grow(box: Box | null, next: Box): Box {
  return box
    ? {
        x0: Math.min(box.x0, next.x0),
        y0: Math.min(box.y0, next.y0),
        x1: Math.max(box.x1, next.x1),
        y1: Math.max(box.y1, next.y1),
      }
    : next;
}

function clip(box: Box): Box | null {
  const clipped = {
    x0: Math.max(0, Math.floor(box.x0)),
    y0: Math.max(0, Math.floor(box.y0)),
    x1: Math.min(TILE, Math.ceil(box.x1)),
    y1: Math.min(TILE, Math.ceil(box.y1)),
  };
  return clipped.x1 > clipped.x0 && clipped.y1 > clipped.y0 ? clipped : null;
}

export interface StrokeSessionOptions {
  nodeId: string;
  boardId: string;
  settings: BrushSettings;
  colour: string;
  mode: PaintMode;
  resolution: number;
}

export interface TouchedTile {
  coord: string;
  tx: number;
  ty: number;
  canvas: OffscreenCanvas;
}

export class StrokeSession {
  private readonly touched = new Map<string, Touched>();

  constructor(private readonly options: StrokeSessionOptions) {}

  private touch(tx: number, ty: number): Touched {
    const coord = coordKey(tx, ty);
    const existing = this.touched.get(coord);
    if (existing) return existing;
    claimTile(this.options.nodeId, this.options.boardId, coord);
    const touched: Touched = {
      coord,
      tx,
      ty,
      wet: createTileCanvas(),
      original: null,
      ready: false,
      dirty: null,
    };
    this.touched.set(coord, touched);
    this.prepare(touched);
    return touched;
  }

  private prepare(touched: Touched): void {
    if (touched.ready) return;
    const entry = tileEntry(this.options.nodeId, touched.coord);
    if (!entry?.canvas) return;
    touched.original = createTileCanvas();
    context2d(touched.original).drawImage(entry.canvas, 0, 0);
    touched.ready = true;
    touched.dirty = grow(touched.dirty, { x0: 0, y0: 0, x1: TILE, y1: TILE });
  }

  add(dabs: Dab[]): void {
    const { settings, colour, mode } = this.options;
    for (const dab of dabs) {
      const { tip, alpha, side, box } = stampFor(dab, settings, colour, mode);
      for (const { tx, ty } of tilesInBox(box)) {
        const touched = this.touch(tx, ty);
        const left = box.x0 - tx * TILE;
        const top = box.y0 - ty * TILE;
        const wet = context2d(touched.wet);
        wet.globalAlpha = alpha;
        wet.drawImage(tip, left, top, side, side);
        const dirty = clip({ x0: left, y0: top, x1: left + side, y1: top + side });
        if (dirty) touched.dirty = grow(touched.dirty, dirty);
      }
    }
  }

  render(): void {
    for (const touched of this.touched.values()) {
      this.prepare(touched);
      if (!touched.ready || !touched.dirty) continue;
      const rect = touched.dirty;
      touched.dirty = null;
      this.composite(touched, rect);
      changed(this.options.nodeId, [touched.coord], rect);
    }
  }

  private source(touched: Touched, rect: Box): OffscreenCanvas {
    const { settings, resolution } = this.options;
    if (settings.grain === 'none') return touched.wet;
    scratch ??= createTileCanvas();
    const drawing = context2d(scratch);
    const width = rect.x1 - rect.x0;
    const height = rect.y1 - rect.y0;
    drawing.clearRect(rect.x0, rect.y0, width, height);
    drawing.drawImage(touched.wet, rect.x0, rect.y0, width, height, rect.x0, rect.y0, width, height);
    drawing.globalCompositeOperation = 'destination-in';
    const pattern = grainPattern(drawing, settings, settings.grainScale * resolution * 0.5, {
      x: -touched.tx * TILE,
      y: -touched.ty * TILE,
    });
    if (pattern) {
      drawing.fillStyle = pattern;
      drawing.fillRect(rect.x0, rect.y0, width, height);
    }
    drawing.globalCompositeOperation = 'source-over';
    return scratch;
  }

  private composite(touched: Touched, rect: Box): void {
    const entry = tileEntry(this.options.nodeId, touched.coord);
    if (!entry?.canvas) return;
    const target = context2d(entry.canvas);
    const width = rect.x1 - rect.x0;
    const height = rect.y1 - rect.y0;
    target.save();
    target.clearRect(rect.x0, rect.y0, width, height);
    if (touched.original) {
      target.drawImage(touched.original, rect.x0, rect.y0, width, height, rect.x0, rect.y0, width, height);
    }
    target.globalCompositeOperation = this.options.mode === 'eraser' ? 'destination-out' : 'source-over';
    target.globalAlpha = this.options.settings.opacity;
    target.drawImage(
      this.source(touched, rect),
      rect.x0,
      rect.y0,
      width,
      height,
      rect.x0,
      rect.y0,
      width,
      height,
    );
    target.restore();
  }

  pendingCoords(): string[] {
    return [...this.touched.values()].filter((touched) => !touched.ready).map((touched) => touched.coord);
  }

  pending(): boolean {
    return this.pendingCoords().length > 0;
  }

  finish(): TouchedTile[] {
    this.render();
    return [...this.touched.values()].flatMap((touched) => {
      const canvas = tileEntry(this.options.nodeId, touched.coord)?.canvas;
      return canvas && touched.ready
        ? [{ coord: touched.coord, tx: touched.tx, ty: touched.ty, canvas }]
        : [];
    });
  }

  release(): void {
    for (const touched of this.touched.values()) releaseTile(this.options.nodeId, touched.coord);
    this.touched.clear();
  }
}
