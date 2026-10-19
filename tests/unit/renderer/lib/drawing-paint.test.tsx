import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { brushSettingsSchema, presetSettings, type BrushSettings } from '@shared/brushes';
import type { BoardNode } from '@shared/board';
import {
  captureBoard,
  commitChanges,
  createBoard,
  getBoardNodes,
  getBoardTiles,
  loadBoard,
  redoBoard,
  undoBoard,
} from '@renderer/lib/board';
import {
  beginPaint,
  brushModified,
  chooseBrushPreset,
  colourAt,
  drawPreview,
  drawingAt,
  getBrushState,
  layerCoords,
  newLayer,
  pickLayer,
  requestLod,
  requestTile,
  resetBrush,
  setBrushColour,
  subscribeLayer,
  updateBrush,
  watchBoard,
  type LayerChange,
  type Sample,
} from '@renderer/lib/drawing';
import { bootTestApp, makeProject, type FakeApi } from '../helpers/api';
import { encodeTile, inked, installCanvasFake } from '../helpers/canvas-fake';

let api: FakeApi;
let boardId: string;

const brush = (patch: Partial<BrushSettings> = {}): BrushSettings => ({
  ...brushSettingsSchema.parse({}),
  ...patch,
});
const sample = (x: number, y: number): Sample => ({ x, y, pressure: 1, tiltX: 0, tiltY: 0 });
const now = (callback: () => void) => {
  callback();
};

beforeEach(async () => {
  installCanvasFake();
  api = await bootTestApp();
  const project = makeProject('Sketch');
  api.current = project;
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
  boardId = (await createBoard({ name: 'Sketch' })).id;
  await loadBoard(boardId);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function startLayer(
  at = { x: 0, y: 0 },
): Promise<{ layer: BoardNode; base: ReturnType<typeof captureBoard> }> {
  const base = captureBoard(boardId);
  const layer = newLayer({ boardId, name: 'Drawing 1', z: 1, at });
  await commitChanges(boardId, { upsertNodes: [layer] }, { history: false });
  return { layer, base };
}

function layerNode(id: string): BoardNode | undefined {
  return getBoardNodes(boardId).find((node) => node.id === id);
}

describe('painting strokes', () => {
  it('paints into new tiles, saves them with the layer bounds and undoes the whole layer', async () => {
    const { layer, base } = await startLayer();
    const paint = beginPaint({
      boardId,
      node: layer,
      base,
      mode: 'brush',
      settings: brush({ size: 10 }),
      colour: '#ff0000',
      seed: 1,
      schedule: now,
    });
    paint.add([sample(10, 10), sample(60, 10)]);
    paint.add([sample(100, 10)]);
    paint.add([]);
    await paint.end();
    await paint.end();
    paint.add([sample(200, 200)]);

    const tiles = Object.values(getBoardTiles(boardId));
    expect(tiles.map((tile) => [tile.nodeId, tile.tx, tile.ty])).toEqual([[layer.id, 0, 0]]);
    expect(vi.mocked(api.applyBoardChanges).mock.calls.at(-1)?.[1].upsertTiles).toHaveLength(1);
    const stored = layerNode(layer.id);
    expect(stored?.x).toBeLessThanOrEqual(5);
    expect(stored?.width).toBeGreaterThan(90);
    expect(stored?.data).toMatchObject({ name: 'Drawing 1', resolution: 2 });

    const canvas = await requestTile(layer.id, '0:0');
    if (!canvas) throw new Error('missing tile');
    expect(inked(canvas as never)).toBeGreaterThan(500);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('missing context');
    const pixel = context.getImageData(100, 20, 1, 1).data;
    expect([...pixel]).toEqual([255, 0, 0, 255]);

    await undoBoard(boardId);
    expect(layerNode(layer.id)).toBeUndefined();
    expect(getBoardTiles(boardId)).toEqual({});
    expect(layerCoords(layer.id)).toEqual([]);
    await redoBoard(boardId);
    expect(layerNode(layer.id)).toBeDefined();
    expect(Object.keys(getBoardTiles(boardId))).toHaveLength(1);
  });

  it('erases paint, drops tiles that become empty and waits for a stroke before undoing', async () => {
    const { layer, base } = await startLayer({ x: 20, y: 20 });
    const draw = beginPaint({
      boardId,
      node: layer,
      base,
      mode: 'brush',
      settings: brush({ size: 8 }),
      colour: '#000000',
      schedule: now,
    });
    draw.add([sample(30, 30), sample(60, 30)]);
    await draw.end();
    const painted = layerNode(layer.id);
    if (!painted) throw new Error('missing layer');

    const erase = beginPaint({
      boardId,
      node: painted,
      base: captureBoard(boardId),
      mode: 'eraser',
      settings: brush({ size: 200 }),
      colour: '#000000',
      schedule: now,
    });
    erase.add([sample(20, 30), sample(80, 30)]);
    await erase.end();
    expect(getBoardTiles(boardId)).toEqual({});
    expect(vi.mocked(api.applyBoardChanges).mock.calls.at(-1)?.[1].removeTiles).toEqual([
      { nodeId: layer.id, tx: 0, ty: 0 },
    ]);
    expect(layerNode(layer.id)).toMatchObject({ width: 1, height: 1 });

    const again = beginPaint({
      boardId,
      node: layerNode(layer.id) ?? painted,
      base: captureBoard(boardId),
      mode: 'brush',
      settings: brush({ size: 8 }),
      colour: '#000000',
    });
    again.add([sample(30, 30), sample(40, 30)]);
    void again.end();
    await undoBoard(boardId);
    expect(getBoardTiles(boardId)).toEqual({});
    await undoBoard(boardId);
    expect(Object.keys(getBoardTiles(boardId))).toHaveLength(1);
  });

  it('applies grain, opacity and scatter without losing the stroke', async () => {
    const { layer, base } = await startLayer();
    const paint = beginPaint({
      boardId,
      node: layer,
      base,
      mode: 'brush',
      settings: { ...presetSettings('chalk'), opacity: 0.5 },
      colour: '#336699',
      seed: 4,
      schedule: now,
    });
    paint.add([sample(10, 10), sample(80, 40)]);
    await paint.end();
    const canvas = await requestTile(layer.id, '0:0');
    expect(canvas && inked(canvas as never)).toBeGreaterThan(100);
  });
});

describe('stored tiles', () => {
  async function storedLayer(): Promise<BoardNode> {
    const layer = {
      ...newLayer({ boardId, name: 'Ink', z: 1, at: { x: 0, y: 0 } }),
      width: 512,
      height: 512,
    };
    layer.data = { ...layer.data, offsetX: 0, offsetY: 0 };
    await commitChanges(boardId, {
      upsertNodes: [layer],
      upsertTiles: [
        {
          nodeId: layer.id,
          tx: 0,
          ty: 0,
          bytes: encodeTile((context) => {
            context.fillStyle = '#00ff00';
            context.fillRect(0, 0, 64, 64);
          }),
        },
        { nodeId: layer.id, tx: 1, ty: 1, bytes: encodeTile(() => undefined) },
      ],
    });
    return layer;
  }

  it('decodes tiles on demand, builds reduced levels and hit tests painted pixels', async () => {
    const layer = await storedLayer();
    watchBoard(boardId);
    expect(layerCoords(layer.id).sort()).toEqual(['0:0', '1:1']);
    expect(drawingAt({ x: 10, y: 10 }, getBoardNodes(boardId))).toBeNull();
    const tile = await requestTile(layer.id, '0:0');
    expect(tile && inked(tile as never)).toBe(64 * 64);
    expect(drawingAt({ x: 10, y: 10 }, getBoardNodes(boardId))?.id).toBe(layer.id);
    expect(drawingAt({ x: 100, y: 100 }, getBoardNodes(boardId))).toBeNull();
    expect(colourAt({ x: 10, y: 10 }, getBoardNodes(boardId))).toBe('#00ff00');
    expect(colourAt({ x: 100, y: 100 }, getBoardNodes(boardId))).toBeNull();
    const overview = await requestLod(layer.id, 1, '0:0');
    expect(overview && inked(overview as never)).toBe(32 * 32);
    expect(await requestLod(layer.id, 1, '0:0')).toBe(overview);
    expect(await requestTile(layer.id, '9:9')).toBeNull();
    expect(await requestLod('missing', 1, '0:0')).toBeNull();
  });

  it('decodes a tile again when its stored bytes change and reports the change', async () => {
    const layer = await storedLayer();
    const changes: LayerChange[] = [];
    const stop = subscribeLayer(layer.id, boardId, (change) => {
      changes.push(change);
    });
    await requestTile(layer.id, '0:0');
    await commitChanges(boardId, {
      upsertTiles: [{ nodeId: layer.id, tx: 0, ty: 0, bytes: encodeTile(() => undefined) }],
      removeTiles: [{ nodeId: layer.id, tx: 1, ty: 1 }],
    });
    expect(changes).toContainEqual({ coords: ['0:0'] });
    expect(changes).toContainEqual({ coords: null });
    const tile = await requestTile(layer.id, '0:0');
    expect(tile && inked(tile as never)).toBe(0);
    stop();
  });

  it('updates a built overview in place while painting instead of rebuilding it', async () => {
    const layer = await storedLayer();
    watchBoard(boardId);
    await requestTile(layer.id, '0:0');
    const overview = await requestLod(layer.id, 1, '0:0');
    if (!overview) throw new Error('missing overview');
    const changes: LayerChange[] = [];
    const stop = subscribeLayer(layer.id, boardId, (change) => {
      changes.push(change);
    });
    const paint = beginPaint({
      boardId,
      node: layer,
      base: captureBoard(boardId),
      mode: 'brush',
      settings: brush({ size: 10 }),
      colour: '#ff0000',
      seed: 2,
      schedule: now,
    });
    paint.add([sample(150, 150), sample(400, 150), sample(600, 150)]);

    expect(await requestLod(layer.id, 1, '0:0')).toBe(overview);
    const pixel = overview.getContext('2d')?.getImageData(150, 150, 1, 1).data;
    expect([...(pixel ?? [])]).toEqual([255, 0, 0, 255]);
    expect(changes).not.toContainEqual({ coords: null });
    expect(layerCoords(layer.id)).toContain('1:0');
    expect(changes.some((change) => change.list === true && change.coords?.includes('1:0'))).toBe(true);
    await paint.end();
    stop();
  });

  it('picks the selected or remembered layer that can be painted', async () => {
    const layer = await storedLayer();
    const nodes = getBoardNodes(boardId);
    expect(pickLayer(nodes, [layer.id], null)?.id).toBe(layer.id);
    expect(pickLayer(nodes, [], layer.id)?.id).toBe(layer.id);
    expect(pickLayer(nodes, [], null)).toBeNull();
    const locked = nodes.map((node) => ({ ...node, data: { ...node.data, locked: true } }));
    expect(pickLayer(locked, [layer.id], layer.id)).toBeNull();
  });
});

describe('brush state', () => {
  it('changes, chooses and resets brushes and saves them after a pause', async () => {
    vi.useFakeTimers();
    expect(getBrushState().brush.preset).toBe('pen');
    updateBrush('brush', { size: 30 });
    expect(getBrushState().brush.settings.size).toBe(30);
    expect(brushModified(getBrushState().brush)).toBe(true);
    resetBrush('brush');
    expect(getBrushState().brush.settings).toEqual(presetSettings('pen'));
    chooseBrushPreset('brush', 'hard-eraser');
    expect(getBrushState().brush.preset).toBe('pen');
    chooseBrushPreset('eraser', 'soft-eraser');
    setBrushColour({ hex: '#123456', ref: null });
    expect(api.setSettings).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(400);
    expect(api.setSettings).toHaveBeenCalledTimes(1);
    expect(api.settings.brushes.eraser).toEqual({
      preset: 'soft-eraser',
      settings: presetSettings('soft-eraser'),
    });
    expect(api.settings.brushes.colour.hex).toBe('#123456');
    expect(getBrushState().colour.hex).toBe('#123456');
  });
});

describe('brush preview', () => {
  it('draws a stroke on paper and cuts it out for the eraser', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 40;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('missing context');
    drawPreview(context, presetSettings('pencil'), '#000000', 'brush');
    const brushData = context.getImageData(0, 0, 120, 40).data;
    expect([...brushData.slice(0, 4)]).toEqual([244, 244, 245, 255]);
    expect(brushData.some((value, index) => index % 4 === 0 && value < 200)).toBe(true);
    drawPreview(context, presetSettings('hard-eraser'), '#64748b', 'eraser');
    const centre = context.getImageData(60, 20, 1, 1).data;
    expect(centre[0]).toBe(244);
  });
});
