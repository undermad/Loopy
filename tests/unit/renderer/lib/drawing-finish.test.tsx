import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MASK_CELLS,
  answerTile,
  createTileFinisher,
  finishTile,
  type FinishedTile,
  type TileReply,
  type TileRequest,
  type TileWorker,
} from '@renderer/lib/drawing';
import { FakeCanvas, inked, installCanvasFake } from '../helpers/canvas-fake';

function painted(): OffscreenCanvas {
  const canvas = new FakeCanvas(512, 512);
  const context = canvas.getContext();
  context.fillStyle = '#ff0000';
  context.fillRect(0, 0, 40, 20);
  return canvas as unknown as OffscreenCanvas;
}

function cells(mask: Uint8Array): number {
  return mask.reduce((total, cell) => total + cell, 0);
}

async function decoded(bytes: Uint8Array): Promise<FakeCanvas> {
  return (await createImageBitmap(new Blob([bytes as BlobPart]))) as unknown as FakeCanvas;
}

class FakeWorker implements TileWorker {
  onmessage: ((event: MessageEvent<TileReply>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly received: { message: TileRequest; transfer: Transferable[] }[] = [];

  postMessage(message: TileRequest, transfer: Transferable[]): void {
    this.received.push({ message, transfer });
  }

  async answer(index: number): Promise<void> {
    const entry = this.received[index];
    if (!entry) throw new Error('no request');
    await answerTile(entry.message, (reply) => {
      this.onmessage?.({ data: reply } as MessageEvent<TileReply>);
    });
  }
}

beforeEach(() => {
  installCanvasFake();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('finishing a painted tile', () => {
  it('builds the hit mask and the stored bytes from the pixels', async () => {
    const finished = await finishTile(painted());
    expect(finished.mask).toHaveLength(MASK_CELLS * MASK_CELLS);
    expect(cells(finished.mask)).toBe(6);
    expect(finished.bytes).not.toBeNull();
    expect(inked(await decoded(finished.bytes ?? new Uint8Array()))).toBe(800);
  });

  it('reports an empty tile without encoding it', async () => {
    const finished = await finishTile(new FakeCanvas(512, 512) as unknown as OffscreenCanvas);
    expect(cells(finished.mask)).toBe(0);
    expect(finished.bytes).toBeNull();
  });

  it('answers a worker request and hands the buffers back without copying', async () => {
    const close = vi.fn();
    const bitmap = Object.assign(painted(), { close }) as unknown as ImageBitmap;
    const post = vi.fn<(reply: TileReply, transfer: Transferable[]) => void>();
    await answerTile({ id: 7, bitmap }, post);
    const [reply, transfer] = post.mock.calls[0] ?? [];
    if (!reply || 'failed' in reply) throw new Error('missing reply');
    expect(reply.id).toBe(7);
    expect(cells(reply.mask)).toBe(6);
    expect(transfer).toEqual([reply.mask.buffer, reply.bytes?.buffer]);
    expect(close).toHaveBeenCalled();
  });

  it('reports a failed tile so the caller can retry it', async () => {
    const close = vi.fn();
    const broken = { width: 0, height: 0, close } as unknown as ImageBitmap;
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        getContext() {
          return null;
        }
      },
    );
    const post = vi.fn<(reply: TileReply, transfer: Transferable[]) => void>();
    await answerTile({ id: 3, bitmap: broken }, post);
    expect(post).toHaveBeenCalledWith({ id: 3, failed: true }, []);
    expect(close).toHaveBeenCalled();
  });
});

describe('the tile finisher', () => {
  it('sends a snapshot to the worker and matches replies to requests', async () => {
    const worker = new FakeWorker();
    const finish = createTileFinisher(() => worker);
    const first = painted();
    const second = new FakeCanvas(512, 512) as unknown as OffscreenCanvas;
    const results: FinishedTile[] = [];
    const done = Promise.all([finish(first), finish(second)]).then((all) => results.push(...all));
    await vi.waitFor(() => {
      expect(worker.received).toHaveLength(2);
    });
    expect(worker.received[0]?.transfer).toEqual([worker.received[0]?.message.bitmap]);
    first.getContext('2d')?.clearRect(0, 0, 512, 512);
    await worker.answer(1);
    await worker.answer(0);
    await done;
    expect(cells(results[0]?.mask ?? new Uint8Array())).toBe(6);
    expect(results[1]?.bytes).toBeNull();
  });

  it('retries a tile the worker could not finish on the main thread', async () => {
    const worker = new FakeWorker();
    const finish = createTileFinisher(() => worker);
    const pending = finish(painted());
    await vi.waitFor(() => {
      expect(worker.received).toHaveLength(1);
    });
    worker.onmessage?.({ data: { id: 999, failed: true } } as MessageEvent<TileReply>);
    worker.onmessage?.({
      data: { id: worker.received[0]?.message.id ?? 0, failed: true },
    } as MessageEvent<TileReply>);
    expect(cells((await pending).mask)).toBe(6);
  });

  it('finishes on the main thread when the worker cannot be created', async () => {
    const finish = createTileFinisher(() => {
      throw new Error('blocked');
    });
    expect(cells((await finish(painted())).mask)).toBe(6);
  });

  it('finishes on the main thread when no worker can start', async () => {
    const finish = createTileFinisher(() => null);
    expect(cells((await finish(painted())).mask)).toBe(6);
  });

  it('falls back to the main thread when the worker fails', async () => {
    const worker = new FakeWorker();
    const spawn = vi.fn(() => worker);
    const finish = createTileFinisher(spawn);
    const pending = finish(painted());
    await vi.waitFor(() => {
      expect(worker.received).toHaveLength(1);
    });
    worker.onerror?.(new ErrorEvent('error'));
    expect(cells((await pending).mask)).toBe(6);
    expect(cells((await finish(painted())).mask)).toBe(6);
    expect(worker.received).toHaveLength(1);
    expect(spawn).toHaveBeenCalledTimes(1);
  });
});
