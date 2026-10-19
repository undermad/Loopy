import type { BoardNode, BoardTile, BoardTileKey } from '@shared/board';
import type { BrushSettings } from '@shared/brushes';
import {
  commitChanges,
  getBoardNodes,
  getBoardTiles,
  tileKey,
  trackBoardWork,
  type BoardBase,
} from '@renderer/lib/board';
import { layerMasks, requestTile, settleTile, watchBoard } from './cache';
import { StrokeSession, type PaintMode } from './engine';
import { createTileFinisher } from './finish';
import {
  intersect,
  layerFrame,
  layerGeometry,
  maskBox,
  nodeBox,
  parseCoord,
  tileBox,
  toRaster,
  type Box,
} from './geometry';
import { createStroke, type Sample } from './stroke';

export interface PaintOptions {
  boardId: string;
  node: BoardNode;
  base: BoardBase | null;
  mode: PaintMode;
  settings: BrushSettings;
  colour: string;
  seed?: number;
  schedule?: (callback: () => void) => void;
}

export interface PaintStroke {
  add: (samples: Sample[]) => void;
  end: () => Promise<void>;
}

const finish = createTileFinisher(() =>
  typeof Worker === 'function'
    ? new Worker(new URL('./tile.worker.ts', import.meta.url), { type: 'module' })
    : null,
);

const nextFrame = (callback: () => void) => {
  requestAnimationFrame(() => {
    callback();
  });
};

export function beginPaint(options: PaintOptions): PaintStroke {
  const { boardId, node, mode, settings } = options;
  watchBoard(boardId);
  const frame = layerFrame(node);
  const sampler = createStroke(settings, frame.resolution, options.seed);
  const session = new StrokeSession({
    nodeId: node.id,
    boardId,
    settings,
    colour: options.colour,
    mode,
    resolution: frame.resolution,
  });
  const schedule = options.schedule ?? nextFrame;
  let scheduled = false;
  let ended = false;

  const flush = () => {
    scheduled = false;
    if (!ended) session.render();
  };

  const raster = (sample: Sample): Sample => ({ ...sample, ...toRaster(sample, frame) });

  async function settle(): Promise<void> {
    session.add(sampler.finish());
    for (let attempt = 0; attempt < 3 && session.pending(); attempt += 1) {
      await Promise.all(session.pendingCoords().map((coord) => requestTile(node.id, coord)));
    }
    const tiles = session.finish();
    const stored = getBoardTiles(boardId);
    const upsertTiles: BoardTile[] = [];
    const removeTiles: BoardTileKey[] = [];
    const finished = await Promise.all(tiles.map((tile) => finish(tile.canvas)));
    tiles.forEach((tile, index) => {
      const { mask, bytes } = finished[index] ?? { mask: null, bytes: null };
      const key = { nodeId: node.id, tx: tile.tx, ty: tile.ty };
      if (!bytes) {
        settleTile(node.id, tile.coord, null, null);
        if (stored[tileKey(key)]) removeTiles.push(key);
        return;
      }
      settleTile(node.id, tile.coord, bytes, mask);
      upsertTiles.push({ ...key, bytes });
    });
    session.release();
    const latest = getBoardNodes(boardId).find((candidate) => candidate.id === node.id) ?? node;
    const previous = nodeBox(latest, frame);
    const boxes = layerMasks(node.id).flatMap(({ coord, mask }): Box[] => {
      const { tx, ty } = parseCoord(coord);
      const box = mask ? maskBox(mask, tx, ty) : intersect(tileBox(tx, ty), previous);
      return box ? [box] : [];
    });
    const geometry = layerGeometry(boxes, frame, latest);
    const { offsetX, offsetY, ...rect } = geometry;
    await commitChanges(
      boardId,
      {
        upsertNodes: [{ ...latest, ...rect, data: { ...latest.data, offsetX, offsetY } }],
        upsertTiles,
        removeTiles,
      },
      { base: options.base },
    );
  }

  return {
    add(samples) {
      if (ended || samples.length === 0) return;
      for (const sample of samples) session.add(sampler.add(raster(sample)));
      if (!scheduled) {
        scheduled = true;
        schedule(flush);
      }
    },
    end() {
      if (ended) return Promise.resolve();
      ended = true;
      const work = settle();
      trackBoardWork(boardId, work);
      return work;
    },
  };
}
