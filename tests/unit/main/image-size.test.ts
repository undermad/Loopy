import { describe, expect, it } from 'vitest';
import { readImageSize } from '../../../src/main/storage/image-size';

function ascii(text: string): number[] {
  return Array.from(text, (character) => character.charCodeAt(0));
}

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

function jpeg(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0, 0, 0, 0, 0x03, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);
  const view = new DataView(bytes.buffer);
  view.setUint16(13, height);
  view.setUint16(15, width);
  return bytes;
}

function gif(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(13);
  bytes.set(ascii('GIF89a'));
  new DataView(bytes.buffer).setUint16(6, width, true);
  new DataView(bytes.buffer).setUint16(8, height, true);
  return bytes;
}

function bmp(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set(ascii('BM'));
  new DataView(bytes.buffer).setInt32(18, width, true);
  new DataView(bytes.buffer).setInt32(22, -height, true);
  return bytes;
}

function webp(chunk: string, fill: (bytes: Uint8Array, view: DataView) => void): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set(ascii('RIFF'), 0);
  bytes.set(ascii('WEBP'), 8);
  bytes.set(ascii(chunk), 12);
  fill(bytes, new DataView(bytes.buffer));
  return bytes;
}

describe('readImageSize', () => {
  it('reads the dimensions of common formats', () => {
    expect(readImageSize(png(640, 480))).toEqual({ width: 640, height: 480 });
    expect(readImageSize(jpeg(1920, 1080))).toEqual({ width: 1920, height: 1080 });
    expect(readImageSize(gif(12, 34))).toEqual({ width: 12, height: 34 });
    expect(readImageSize(bmp(100, 50))).toEqual({ width: 100, height: 50 });
    expect(
      readImageSize(
        webp('VP8 ', (_bytes, view) => {
          view.setUint16(26, 300, true);
          view.setUint16(28, 200, true);
        }),
      ),
    ).toEqual({ width: 300, height: 200 });
    expect(
      readImageSize(
        webp('VP8L', (_bytes, view) => {
          view.setUint32(21, 300 | (200 << 14), true);
        }),
      ),
    ).toEqual({ width: 301, height: 201 });
    expect(
      readImageSize(
        webp('VP8X', (bytes) => {
          bytes.set([0x9f, 0x0f, 0x00, 0xb7, 0x0b, 0x00], 24);
        }),
      ),
    ).toEqual({ width: 4000, height: 3000 });
  });

  it('returns null for unknown or truncated data', () => {
    expect(readImageSize(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(readImageSize(new TextEncoder().encode('not an image at all, honestly'))).toBeNull();
    expect(readImageSize(png(0, 10))).toBeNull();
    expect(readImageSize(new Uint8Array([0xff, 0xd8, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
    expect(readImageSize(webp('XXXX', () => undefined))).toBeNull();
  });
});
