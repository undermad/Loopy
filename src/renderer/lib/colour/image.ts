import type { Pixels } from './extract';

export const MAX_EXTRACT_SIZE = 256;

export async function loadPixels(blob: Blob, maxSize = MAX_EXTRACT_SIZE): Promise<Pixels> {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not available');
    context.drawImage(bitmap, 0, 0, width, height);
    const image = context.getImageData(0, 0, width, height);
    return { data: image.data, width, height };
  } finally {
    bitmap.close();
  }
}

export async function fetchPixels(url: string, maxSize = MAX_EXTRACT_SIZE): Promise<Pixels> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}`);
  return loadPixels(await response.blob(), maxSize);
}
