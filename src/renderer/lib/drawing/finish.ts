import { TILE, maskFromAlpha } from './geometry';

export interface FinishedTile {
  mask: Uint8Array;
  bytes: Uint8Array<ArrayBuffer> | null;
}

export interface TileRequest {
  id: number;
  bitmap: ImageBitmap;
}

export type TileReply = (FinishedTile & { id: number }) | { id: number; failed: true };

export interface TileWorker {
  onmessage: ((event: MessageEvent<TileReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage: (message: TileRequest, transfer: Transferable[]) => void;
}

interface Job {
  canvas: OffscreenCanvas;
  resolve: (finished: FinishedTile) => void;
  reject: (reason: unknown) => void;
}

export async function finishTile(source: CanvasImageSource): Promise<FinishedTile> {
  const canvas = new OffscreenCanvas(TILE, TILE);
  const drawing = canvas.getContext('2d', { willReadFrequently: true });
  if (!drawing) throw new Error('2D canvas is not available');
  drawing.drawImage(source, 0, 0);
  const mask = maskFromAlpha(drawing.getImageData(0, 0, TILE, TILE).data);
  if (!mask.includes(1)) return { mask, bytes: null };
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return { mask, bytes: new Uint8Array(await blob.arrayBuffer()) };
}

export async function answerTile(
  request: TileRequest,
  post: (reply: TileReply, transfer: Transferable[]) => void,
): Promise<void> {
  try {
    const finished = await finishTile(request.bitmap);
    const transfer = finished.bytes ? [finished.mask.buffer, finished.bytes.buffer] : [finished.mask.buffer];
    post({ id: request.id, ...finished }, transfer);
  } catch {
    post({ id: request.id, failed: true }, []);
  } finally {
    request.bitmap.close();
  }
}

export function createTileFinisher(
  spawn: () => TileWorker | null,
): (canvas: OffscreenCanvas) => Promise<FinishedTile> {
  let worker: TileWorker | null | undefined;
  let next = 0;
  const pending = new Map<number, Job>();

  const inline = (job: Job) => finishTile(job.canvas).then(job.resolve, job.reject);

  const fail = () => {
    worker = null;
    const jobs = [...pending.values()];
    pending.clear();
    for (const job of jobs) void inline(job);
  };

  const start = (): TileWorker | null => {
    if (worker !== undefined) return worker;
    try {
      worker = spawn();
    } catch {
      worker = null;
    }
    if (worker) {
      worker.onmessage = ({ data }) => {
        const job = pending.get(data.id);
        if (!job) return;
        pending.delete(data.id);
        if ('failed' in data) void inline(job);
        else job.resolve({ mask: data.mask, bytes: data.bytes });
      };
      worker.onerror = fail;
    }
    return worker;
  };

  return async (canvas) => {
    const target = start();
    if (!target) return finishTile(canvas);
    const bitmap = await createImageBitmap(canvas);
    return new Promise<FinishedTile>((resolve, reject) => {
      const job = { canvas, resolve, reject };
      if (worker !== target) {
        bitmap.close();
        void inline(job);
        return;
      }
      next += 1;
      pending.set(next, job);
      target.postMessage({ id: next, bitmap }, [bitmap]);
    });
  };
}
