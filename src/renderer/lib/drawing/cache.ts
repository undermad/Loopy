import { getBoardTiles, subscribeBoardTiles, type TileMap } from '@renderer/lib/board';
import { TILE, coordKey, maskFromAlpha, maskHit, parseCoord, type Box } from './geometry';

interface Entry {
  bytes: Uint8Array | null;
  canvas: OffscreenCanvas | null;
  mask: Uint8Array | null;
  decoding: Promise<OffscreenCanvas | null> | null;
  used: number;
  pins: number;
}

interface Layer {
  boardId: string;
  entries: Map<string, Entry>;
  listeners: Set<LayerListener>;
  reduced: Map<string, Promise<OffscreenCanvas | null>>;
  version: number;
  coords: string[] | null;
}

export interface LayerChange {
  coords: string[] | null;
  rect?: Box;
}

type LayerListener = (change: LayerChange) => void;

const MAX_DECODED = 160;
const layers = new Map<string, Layer>();
let clock = 0;
let unsubscribe: (() => void) | null = null;
const watched = new Set<string>();

export function createTileCanvas(width = TILE, height = TILE): OffscreenCanvas {
  return new OffscreenCanvas(width, height);
}

export function context2d(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is not available');
  return context;
}

function layerFor(nodeId: string, boardId: string): Layer {
  let layer = layers.get(nodeId);
  if (!layer) {
    layer = {
      boardId,
      entries: new Map(),
      listeners: new Set(),
      reduced: new Map(),
      version: 0,
      coords: null,
    };
    layers.set(nodeId, layer);
  }
  return layer;
}

function emit(nodeId: string, change: LayerChange): void {
  const layer = layers.get(nodeId);
  if (!layer) return;
  if (change.coords === null) {
    layer.version += 1;
    layer.coords = null;
  }
  forgetReduced(layer, change.coords);
  for (const listener of [...layer.listeners]) listener(change);
}

function forgetReduced(layer: Layer, coords: string[] | null): void {
  if (coords === null) {
    layer.reduced.clear();
    return;
  }
  for (const coord of coords) {
    const { tx, ty } = parseCoord(coord);
    for (let level = 1; level <= 8; level += 1) {
      layer.reduced.delete(
        `${String(level)}:${coordKey(Math.floor(tx / 2 ** level), Math.floor(ty / 2 ** level))}`,
      );
    }
  }
}

function sync(boardId: string, tiles: TileMap): void {
  const present = new Map<string, Set<string>>();
  const added = new Set<string>();
  const dirty = new Map<string, string[]>();
  for (const tile of Object.values(tiles)) {
    const coord = coordKey(tile.tx, tile.ty);
    const layer = layerFor(tile.nodeId, boardId);
    present.set(tile.nodeId, (present.get(tile.nodeId) ?? new Set()).add(coord));
    const entry = layer.entries.get(coord);
    if (!entry) {
      layer.entries.set(coord, {
        bytes: tile.bytes,
        canvas: null,
        mask: null,
        decoding: null,
        used: 0,
        pins: 0,
      });
      layer.coords = null;
      added.add(tile.nodeId);
    } else if (entry.bytes !== tile.bytes) {
      entry.bytes = tile.bytes;
      entry.decoding = null;
      if (entry.pins === 0) {
        entry.canvas = null;
        entry.mask = null;
      }
      dirty.set(tile.nodeId, [...(dirty.get(tile.nodeId) ?? []), coord]);
    }
  }
  for (const [nodeId, layer] of layers) {
    if (layer.boardId !== boardId) continue;
    const kept = present.get(nodeId);
    let removed = false;
    for (const [coord, entry] of layer.entries) {
      if (kept?.has(coord) || entry.bytes === null) continue;
      layer.entries.delete(coord);
      removed = true;
    }
    if (removed || added.has(nodeId)) emit(nodeId, { coords: null });
    const coords = dirty.get(nodeId);
    if (coords) emit(nodeId, { coords });
    if (layer.entries.size === 0 && layer.listeners.size === 0) layers.delete(nodeId);
  }
}

function ensureSubscribed(): void {
  if (unsubscribe) return;
  unsubscribe = subscribeBoardTiles(sync);
}

export function watchBoard(boardId: string): void {
  ensureSubscribed();
  if (watched.has(boardId)) return;
  watched.add(boardId);
  sync(boardId, getBoardTiles(boardId));
}

const NO_COORDS: string[] = [];

export function layerCoords(nodeId: string): string[] {
  ensureSubscribed();
  const layer = layers.get(nodeId);
  if (!layer) return NO_COORDS;
  layer.coords ??= [...layer.entries.keys()];
  return layer.coords;
}

export function subscribeLayer(nodeId: string, boardId: string, listener: LayerListener): () => void {
  watchBoard(boardId);
  const layer = layerFor(nodeId, boardId);
  layer.listeners.add(listener);
  return () => {
    layer.listeners.delete(listener);
  };
}

function evict(): void {
  const decoded: { layer: Layer; coord: string; entry: Entry }[] = [];
  for (const layer of layers.values()) {
    for (const [coord, entry] of layer.entries) {
      if (entry.canvas && entry.bytes && entry.pins === 0) decoded.push({ layer, coord, entry });
    }
  }
  if (decoded.length <= MAX_DECODED) return;
  decoded.sort((a, b) => a.entry.used - b.entry.used);
  for (const { entry } of decoded.slice(0, decoded.length - MAX_DECODED)) entry.canvas = null;
}

export function readMask(canvas: OffscreenCanvas): Uint8Array {
  return maskFromAlpha(context2d(canvas).getImageData(0, 0, TILE, TILE).data);
}

async function decode(bytes: Uint8Array): Promise<OffscreenCanvas> {
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: 'image/png' }));
  const canvas = createTileCanvas();
  context2d(canvas).drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

export function peekTile(nodeId: string, coord: string): OffscreenCanvas | null {
  const entry = layers.get(nodeId)?.entries.get(coord);
  if (!entry) return null;
  entry.used = ++clock;
  return entry.canvas;
}

export function requestTile(nodeId: string, coord: string): Promise<OffscreenCanvas | null> {
  const entry = layers.get(nodeId)?.entries.get(coord);
  if (!entry) return Promise.resolve(null);
  entry.used = ++clock;
  if (entry.canvas) return Promise.resolve(entry.canvas);
  const bytes = entry.bytes;
  if (!bytes) return Promise.resolve(null);
  if (entry.decoding) return entry.decoding;
  const work = decode(bytes)
    .then((canvas) => {
      if (entry.bytes !== bytes) return entry.canvas;
      entry.canvas = canvas;
      entry.mask = readMask(canvas);
      evict();
      return canvas;
    })
    .catch(() => null)
    .finally(() => {
      if (entry.decoding === work) entry.decoding = null;
    });
  entry.decoding = work;
  return work;
}

export function requestLod(nodeId: string, level: number, coord: string): Promise<OffscreenCanvas | null> {
  if (level === 0) return requestTile(nodeId, coord);
  const layer = layers.get(nodeId);
  if (!layer) return Promise.resolve(null);
  const key = `${String(level)}:${coord}`;
  const cached = layer.reduced.get(key);
  if (cached) return cached;
  const { tx, ty } = parseCoord(coord);
  const span = 2 ** level;
  const below = new Set<string>();
  for (const child of layer.entries.keys()) {
    const position = parseCoord(child);
    if (Math.floor(position.tx / span) !== tx || Math.floor(position.ty / span) !== ty) continue;
    below.add(
      coordKey(Math.floor(position.tx / 2 ** (level - 1)), Math.floor(position.ty / 2 ** (level - 1))),
    );
  }
  const work = Promise.all(
    [...below].map(async (child) => ({ child, canvas: await requestLod(nodeId, level - 1, child) })),
  ).then((children) => {
    const canvas = createTileCanvas();
    const drawing = context2d(canvas);
    drawing.imageSmoothingQuality = 'high';
    for (const { child, canvas: source } of children) {
      if (!source) continue;
      const position = parseCoord(child);
      drawing.drawImage(
        source,
        (position.tx - tx * 2) * (TILE / 2),
        (position.ty - ty * 2) * (TILE / 2),
        TILE / 2,
        TILE / 2,
      );
    }
    return canvas;
  });
  layer.reduced.set(key, work);
  return work;
}

export function claimTile(nodeId: string, boardId: string, coord: string): Entry {
  const layer = layerFor(nodeId, boardId);
  let entry = layer.entries.get(coord);
  if (!entry) {
    entry = { bytes: null, canvas: createTileCanvas(), mask: null, decoding: null, used: ++clock, pins: 0 };
    layer.entries.set(coord, entry);
    emit(nodeId, { coords: null });
  }
  entry.pins += 1;
  if (!entry.canvas && entry.bytes) void requestTile(nodeId, coord);
  return entry;
}

export function releaseTile(nodeId: string, coord: string): void {
  const entry = layers.get(nodeId)?.entries.get(coord);
  if (entry) entry.pins = Math.max(0, entry.pins - 1);
}

export function tileEntry(nodeId: string, coord: string): Entry | null {
  return layers.get(nodeId)?.entries.get(coord) ?? null;
}

export function settleTile(
  nodeId: string,
  coord: string,
  bytes: Uint8Array | null,
  mask: Uint8Array | null,
): void {
  const layer = layers.get(nodeId);
  const entry = layer?.entries.get(coord);
  if (!layer || !entry) return;
  if (bytes === null) {
    layer.entries.delete(coord);
    emit(nodeId, { coords: null });
    return;
  }
  entry.bytes = bytes;
  entry.mask = mask;
}

export function changed(nodeId: string, coords: string[], rect?: Box): void {
  emit(nodeId, rect ? { coords, rect } : { coords });
}

export function layerMasks(nodeId: string): { coord: string; mask: Uint8Array | null }[] {
  return [...(layers.get(nodeId)?.entries ?? [])].map(([coord, entry]) => ({ coord, mask: entry.mask }));
}

export function hitLayer(nodeId: string, x: number, y: number): boolean {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  const coord = coordKey(tx, ty);
  const entry = layers.get(nodeId)?.entries.get(coord);
  if (!entry) return false;
  if (!entry.mask) {
    void requestTile(nodeId, coord);
    return false;
  }
  return maskHit(entry.mask, x - tx * TILE, y - ty * TILE);
}

export function sampleLayer(nodeId: string, x: number, y: number): [number, number, number, number] | null {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  const canvas = peekTile(nodeId, coordKey(tx, ty));
  if (!canvas) return null;
  const pixel = context2d(canvas).getImageData(
    Math.floor(x - tx * TILE),
    Math.floor(y - ty * TILE),
    1,
    1,
  ).data;
  return [pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0, pixel[3] ?? 0];
}

export function resetTileCache(): void {
  unsubscribe?.();
  unsubscribe = null;
  watched.clear();
  layers.clear();
  clock = 0;
}
