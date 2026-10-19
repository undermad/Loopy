import { vi } from 'vitest';

interface Pixels {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}

interface FakePattern {
  source: Pixels;
  matrix: { a: number; d: number; e: number; f: number };
  setTransform: (matrix: { a: number; d: number; e: number; f: number }) => void;
}

interface State {
  globalAlpha: number;
  globalCompositeOperation: string;
  fillStyle: string | FakePattern;
}

type Rgba = [number, number, number, number];

function parseColour(value: string): Rgba {
  const hex = value.replace('#', '');
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    const number = Number.parseInt(hex, 16);
    return [(number >> 16) & 255, (number >> 8) & 255, number & 255, 255];
  }
  return [0, 0, 0, 255];
}

function read(source: Pixels, at: number): Rgba {
  return [
    source.pixels[at] ?? 0,
    source.pixels[at + 1] ?? 0,
    source.pixels[at + 2] ?? 0,
    source.pixels[at + 3] ?? 0,
  ];
}

export class FakeContext {
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';
  fillStyle: string | FakePattern = '#000000';
  imageSmoothingQuality = 'low';
  private readonly stack: State[] = [];

  constructor(readonly canvas: Pixels) {}

  private blend(index: number, rgba: Rgba): void {
    const data = this.canvas.pixels;
    const alpha = (rgba[3] / 255) * this.globalAlpha;
    const below = (data[index + 3] ?? 0) / 255;
    const mode = this.globalCompositeOperation;
    if (mode === 'destination-out') {
      data[index + 3] = Math.round(below * (1 - alpha) * 255);
      return;
    }
    if (mode === 'destination-in') {
      data[index + 3] = Math.round(below * alpha * 255);
      return;
    }
    const over = mode === 'destination-over';
    const top = over ? below : alpha;
    const bottom = over ? alpha : below;
    const out = top + bottom * (1 - top);
    if (out === 0) return;
    for (let channel = 0; channel < 3; channel += 1) {
      const mine = data[index + channel] ?? 0;
      const theirs = rgba[channel] ?? 0;
      const upper = over ? mine : theirs;
      const lower = over ? theirs : mine;
      data[index + channel] = Math.round((upper * top + lower * bottom * (1 - top)) / out);
    }
    data[index + 3] = Math.round(out * 255);
  }

  private each(
    x: number,
    y: number,
    width: number,
    height: number,
    paint: (px: number, py: number) => void,
  ): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.canvas.width, Math.ceil(x + width));
    const y1 = Math.min(this.canvas.height, Math.ceil(y + height));
    for (let py = y0; py < y1; py += 1) for (let px = x0; px < x1; px += 1) paint(px, py);
  }

  clearRect(x: number, y: number, width: number, height: number): void {
    this.each(x, y, width, height, (px, py) => {
      const at = (py * this.canvas.width + px) * 4;
      this.canvas.pixels.fill(0, at, at + 4);
    });
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    const style = this.fillStyle;
    this.each(x, y, width, height, (px, py) => {
      let rgba: Rgba;
      if (typeof style === 'string') rgba = parseColour(style);
      else {
        const { source, matrix } = style;
        const sx = Math.floor((px - matrix.e) / matrix.a);
        const sy = Math.floor((py - matrix.f) / matrix.d);
        const wx = ((sx % source.width) + source.width) % source.width;
        const wy = ((sy % source.height) + source.height) % source.height;
        rgba = read(source, (wy * source.width + wx) * 4);
      }
      this.blend((py * this.canvas.width + px) * 4, rgba);
    });
  }

  drawImage(source: Pixels, ...args: number[]): void {
    let [sx, sy, sw, sh, dx, dy, dw, dh] = [
      0,
      0,
      source.width,
      source.height,
      0,
      0,
      source.width,
      source.height,
    ];
    if (args.length === 2) [dx, dy] = args as [number, number];
    else if (args.length === 4) [dx, dy, dw, dh] = args as [number, number, number, number];
    else
      [sx, sy, sw, sh, dx, dy, dw, dh] = args as [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ];
    if (dw <= 0 || dh <= 0) return;
    this.each(dx, dy, dw, dh, (px, py) => {
      const u = Math.floor(sx + ((px + 0.5 - dx) / dw) * sw);
      const v = Math.floor(sy + ((py + 0.5 - dy) / dh) * sh);
      if (u < 0 || v < 0 || u >= source.width || v >= source.height) return;
      this.blend((py * this.canvas.width + px) * 4, read(source, (v * source.width + u) * 4));
    });
  }

  getImageData(x: number, y: number, width: number, height: number): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let row = 0; row < height; row += 1) {
      const start = ((y + row) * this.canvas.width + x) * 4;
      data.set(this.canvas.pixels.subarray(start, start + width * 4), row * width * 4);
    }
    return { data, width, height } as ImageData;
  }

  putImageData(image: ImageData, x: number, y: number): void {
    for (let row = 0; row < image.height; row += 1) {
      const start = row * image.width * 4;
      this.canvas.pixels.set(
        image.data.subarray(start, start + image.width * 4),
        ((y + row) * this.canvas.width + x) * 4,
      );
    }
  }

  createImageData(width: number, height: number): ImageData {
    return { data: new Uint8ClampedArray(width * height * 4), width, height } as ImageData;
  }

  createPattern(source: Pixels): FakePattern {
    const pattern: FakePattern = {
      source,
      matrix: { a: 1, d: 1, e: 0, f: 0 },
      setTransform(matrix) {
        pattern.matrix = matrix;
      },
    };
    return pattern;
  }

  save(): void {
    this.stack.push({
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
      fillStyle: this.fillStyle,
    });
  }

  restore(): void {
    const state = this.stack.pop();
    if (state) Object.assign(this, state);
  }
}

const HEADER = 8;

function pack(canvas: Pixels): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(HEADER + canvas.pixels.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, canvas.width);
  view.setUint32(4, canvas.height);
  bytes.set(canvas.pixels, HEADER);
  return bytes;
}

export class FakeCanvas implements Pixels {
  pixels: Uint8ClampedArray;
  private context: FakeContext | null = null;

  constructor(
    public width: number,
    public height: number,
  ) {
    this.pixels = new Uint8ClampedArray(width * height * 4);
  }

  getContext(): FakeContext {
    this.context ??= new FakeContext(this);
    return this.context;
  }

  convertToBlob(): Promise<Blob> {
    const bytes = pack(this);
    return Promise.resolve({ arrayBuffer: () => Promise.resolve(bytes.buffer) } as Blob);
  }
}

export function encodeTile(paint: (context: FakeContext) => void, size = 512): Uint8Array<ArrayBuffer> {
  const canvas = new FakeCanvas(size, size);
  paint(canvas.getContext());
  return pack(canvas);
}

function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(new Uint8Array(reader.result as ArrayBuffer));
    };
    reader.readAsArrayBuffer(blob);
  });
}

export function inked(canvas: Pixels): number {
  let count = 0;
  for (let index = 3; index < canvas.pixels.length; index += 4)
    if ((canvas.pixels[index] ?? 0) > 0) count += 1;
  return count;
}

export function installCanvasFake(): { frames: () => void } {
  const elements = new WeakMap<HTMLCanvasElement, FakeCanvas>();
  vi.stubGlobal('OffscreenCanvas', FakeCanvas);
  vi.stubGlobal(
    'DOMMatrix',
    class {
      a: number;
      d: number;
      e: number;
      f: number;
      constructor([a = 1, , , d = 1, e = 0, f = 0]: number[] = []) {
        this.a = a;
        this.d = d;
        this.e = e;
        this.f = f;
      }
    },
  );
  vi.stubGlobal('createImageBitmap', async (source: Blob | FakeCanvas) => {
    if (source instanceof FakeCanvas) {
      const copy = new FakeCanvas(source.width, source.height);
      copy.pixels.set(source.pixels);
      return Object.assign(copy, { close: () => undefined });
    }
    const bytes = await blobBytes(source);
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    const bitmap = new FakeCanvas(view.getUint32(0), view.getUint32(4));
    bitmap.pixels.set(bytes.subarray(HEADER));
    return Object.assign(bitmap, { close: () => undefined });
  });
  const queue: (() => void)[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
    queue.push(callback);
    return queue.length;
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    let canvas = elements.get(this);
    if (canvas?.width !== this.width || canvas.height !== this.height) {
      canvas = new FakeCanvas(this.width, this.height);
      elements.set(this, canvas);
    }
    return canvas.getContext() as never;
  });
  return {
    frames: () => {
      for (const callback of queue.splice(0)) callback();
    },
  };
}

export function elementPixels(element: HTMLCanvasElement): Pixels {
  return (element.getContext('2d') as unknown as FakeContext).canvas;
}
