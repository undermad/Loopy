import { DRAWING_TILE_SIZE, drawingDataSchema, type BoardNode } from '@shared/board';

export const TILE = DRAWING_TILE_SIZE;
export const MASK_CELLS = 32;
const MAX_LEVEL = 8;

export interface Frame {
  originX: number;
  originY: number;
  resolution: number;
}

export interface TileRange {
  level: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface LayerGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function drawingData(node: Pick<BoardNode, 'data'>): {
  resolution: number;
  offsetX: number;
  offsetY: number;
} {
  const parsed = drawingDataSchema.safeParse(node.data);
  const data = parsed.success ? parsed.data : drawingDataSchema.parse({});
  return { resolution: data.resolution, offsetX: data.offsetX, offsetY: data.offsetY };
}

export function layerFrame(node: Pick<BoardNode, 'x' | 'y' | 'data'>): Frame {
  const { resolution, offsetX, offsetY } = drawingData(node);
  return { originX: node.x - offsetX, originY: node.y - offsetY, resolution };
}

export function toRaster(point: { x: number; y: number }, frame: Frame): { x: number; y: number } {
  return {
    x: (point.x - frame.originX) * frame.resolution,
    y: (point.y - frame.originY) * frame.resolution,
  };
}

export function coordKey(tx: number, ty: number): string {
  return `${String(tx)}:${String(ty)}`;
}

export function parseCoord(key: string): { tx: number; ty: number } {
  const [tx = 0, ty = 0] = key.split(':').map(Number);
  return { tx, ty };
}

export function tilesInBox(box: Box): { tx: number; ty: number }[] {
  const tiles: { tx: number; ty: number }[] = [];
  const tx0 = Math.floor(box.x0 / TILE);
  const ty0 = Math.floor(box.y0 / TILE);
  const tx1 = Math.floor((box.x1 - 1e-6) / TILE);
  const ty1 = Math.floor((box.y1 - 1e-6) / TILE);
  for (let ty = ty0; ty <= ty1; ty += 1) for (let tx = tx0; tx <= tx1; tx += 1) tiles.push({ tx, ty });
  return tiles;
}

export function lodLevel(zoom: number, resolution: number): number {
  const scale = zoom * resolution;
  if (!(scale > 0)) return 0;
  return Math.max(0, Math.min(MAX_LEVEL, Math.floor(Math.log2(1 / scale))));
}

export function visibleRange(
  viewport: { x: number; y: number; zoom: number },
  size: { width: number; height: number },
  frame: Frame,
): TileRange {
  const level = lodLevel(viewport.zoom, frame.resolution);
  const span = TILE * 2 ** level;
  const left = (-viewport.x / viewport.zoom - frame.originX) * frame.resolution;
  const top = (-viewport.y / viewport.zoom - frame.originY) * frame.resolution;
  const right = left + (size.width / viewport.zoom) * frame.resolution;
  const bottom = top + (size.height / viewport.zoom) * frame.resolution;
  return {
    level,
    x0: Math.floor(left / span) - 1,
    y0: Math.floor(top / span) - 1,
    x1: Math.floor(right / span) + 1,
    y1: Math.floor(bottom / span) + 1,
  };
}

export function levelKeys(coords: Iterable<string>, level: number): string[] {
  const keys = new Set<string>();
  for (const key of coords) {
    const { tx, ty } = parseCoord(key);
    keys.add(coordKey(Math.floor(tx / 2 ** level), Math.floor(ty / 2 ** level)));
  }
  return [...keys];
}

export function inRange(key: string, range: TileRange): boolean {
  const { tx, ty } = parseCoord(key);
  return tx >= range.x0 && tx <= range.x1 && ty >= range.y0 && ty <= range.y1;
}

export function maskBox(mask: Uint8Array, tx: number, ty: number): Box | null {
  const cell = TILE / MASK_CELLS;
  let box: Box | null = null;
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === 0) continue;
    const x0 = tx * TILE + (index % MASK_CELLS) * cell;
    const y0 = ty * TILE + Math.floor(index / MASK_CELLS) * cell;
    box = box
      ? {
          x0: Math.min(box.x0, x0),
          y0: Math.min(box.y0, y0),
          x1: Math.max(box.x1, x0 + cell),
          y1: Math.max(box.y1, y0 + cell),
        }
      : { x0, y0, x1: x0 + cell, y1: y0 + cell };
  }
  return box;
}

export function maskFromAlpha(pixels: Uint8ClampedArray, threshold = 4): Uint8Array {
  const mask = new Uint8Array(MASK_CELLS * MASK_CELLS);
  const cell = TILE / MASK_CELLS;
  for (let y = 0; y < TILE; y += 1) {
    const row = Math.floor(y / cell) * MASK_CELLS;
    for (let x = 0; x < TILE; x += 1) {
      if ((pixels[(y * TILE + x) * 4 + 3] ?? 0) > threshold) mask[row + Math.floor(x / cell)] = 1;
    }
  }
  return mask;
}

export function maskHit(mask: Uint8Array, localX: number, localY: number): boolean {
  if (localX < 0 || localY < 0 || localX >= TILE || localY >= TILE) return false;
  const cell = TILE / MASK_CELLS;
  return mask[Math.floor(localY / cell) * MASK_CELLS + Math.floor(localX / cell)] === 1;
}

export function layerGeometry(
  boxes: Box[],
  frame: Frame,
  fallback: Pick<BoardNode, 'x' | 'y'>,
): LayerGeometry {
  const first = boxes[0];
  if (!first) {
    return {
      x: fallback.x,
      y: fallback.y,
      width: 1,
      height: 1,
      offsetX: fallback.x - frame.originX,
      offsetY: fallback.y - frame.originY,
    };
  }
  const union = boxes.reduce(
    (all, box) => ({
      x0: Math.min(all.x0, box.x0),
      y0: Math.min(all.y0, box.y0),
      x1: Math.max(all.x1, box.x1),
      y1: Math.max(all.y1, box.y1),
    }),
    first,
  );
  const offsetX = union.x0 / frame.resolution;
  const offsetY = union.y0 / frame.resolution;
  return {
    x: frame.originX + offsetX,
    y: frame.originY + offsetY,
    width: Math.max(1, (union.x1 - union.x0) / frame.resolution),
    height: Math.max(1, (union.y1 - union.y0) / frame.resolution),
    offsetX,
    offsetY,
  };
}

export function nodeBox(node: Pick<BoardNode, 'x' | 'y' | 'width' | 'height'>, frame: Frame): Box {
  return {
    x0: (node.x - frame.originX) * frame.resolution,
    y0: (node.y - frame.originY) * frame.resolution,
    x1: (node.x + node.width - frame.originX) * frame.resolution,
    y1: (node.y + node.height - frame.originY) * frame.resolution,
  };
}

export function intersect(a: Box, b: Box): Box | null {
  const box = {
    x0: Math.max(a.x0, b.x0),
    y0: Math.max(a.y0, b.y0),
    x1: Math.min(a.x1, b.x1),
    y1: Math.min(a.y1, b.y1),
  };
  return box.x1 > box.x0 && box.y1 > box.y0 ? box : null;
}

export function tileBox(tx: number, ty: number): Box {
  return { x0: tx * TILE, y0: ty * TILE, x1: (tx + 1) * TILE, y1: (ty + 1) * TILE };
}
