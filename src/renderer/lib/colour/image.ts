import type { Pixels } from './extract';

export const MAX_EXTRACT_SIZE = 256;
export const MAX_PREVIEW_SIZE = 1024;

export interface DecodedImage {
  pixels: Pixels;
  preview: ImageBitmap;
}

function fit(width: number, height: number, maxSize: number): { width: number; height: number } {
  const scale = Math.min(1, maxSize / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function readPixels(bitmap: ImageBitmap, maxSize: number): Pixels {
  const { width, height } = fit(bitmap.width, bitmap.height, maxSize);
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');
  context.drawImage(bitmap, 0, 0, width, height);
  const image = context.getImageData(0, 0, width, height);
  return { data: image.data, width, height };
}

export async function loadImage(blob: Blob): Promise<DecodedImage> {
  const bitmap = await createImageBitmap(blob);
  try {
    const pixels = readPixels(bitmap, MAX_EXTRACT_SIZE);
    const size = fit(bitmap.width, bitmap.height, MAX_PREVIEW_SIZE);
    const preview = await createImageBitmap(bitmap, {
      resizeWidth: size.width,
      resizeHeight: size.height,
      resizeQuality: 'high',
    });
    return { pixels, preview };
  } finally {
    bitmap.close();
  }
}

export async function fetchImage(url: string): Promise<DecodedImage> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}`);
  return loadImage(await response.blob());
}
