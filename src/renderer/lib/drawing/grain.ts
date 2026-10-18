import type { BrushGrain } from '@shared/brushes';
import { seededRandom } from './stroke';

export const GRAIN_SIZE = 256;

const GRAIN_OCTAVES: Record<Exclude<BrushGrain, 'none'>, { period: number; weight: number }[]> = {
  paper: [
    { period: 64, weight: 0.55 },
    { period: 128, weight: 0.45 },
  ],
  rough: [
    { period: 16, weight: 0.5 },
    { period: 32, weight: 0.3 },
    { period: 128, weight: 0.2 },
  ],
};

function lattice(period: number, seed: number): Float32Array {
  const random = seededRandom(seed);
  const values = new Float32Array(period * period);
  for (let index = 0; index < values.length; index += 1) values[index] = random();
  return values;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

export function grainField(kind: Exclude<BrushGrain, 'none'>, size = GRAIN_SIZE): Float32Array {
  const field = new Float32Array(size * size);
  GRAIN_OCTAVES[kind].forEach(({ period, weight }, octave) => {
    const values = lattice(period, 7919 * (octave + 1));
    const cell = size / period;
    for (let y = 0; y < size; y += 1) {
      const gy = y / cell;
      const y0 = Math.floor(gy) % period;
      const y1 = (y0 + 1) % period;
      const ty = smooth(gy - Math.floor(gy));
      for (let x = 0; x < size; x += 1) {
        const gx = x / cell;
        const x0 = Math.floor(gx) % period;
        const x1 = (x0 + 1) % period;
        const tx = smooth(gx - Math.floor(gx));
        const top = (values[y0 * period + x0] ?? 0) * (1 - tx) + (values[y0 * period + x1] ?? 0) * tx;
        const bottom = (values[y1 * period + x0] ?? 0) * (1 - tx) + (values[y1 * period + x1] ?? 0) * tx;
        const index = y * size + x;
        field[index] = (field[index] ?? 0) + (top * (1 - ty) + bottom * ty) * weight;
      }
    }
  });
  return field;
}

export function grainAlpha(field: Float32Array, depth: number, pixels: Uint8ClampedArray): void {
  for (let index = 0; index < field.length; index += 1) {
    const value = field[index] ?? 0;
    const contrast = Math.min(1, Math.max(0, (value - 0.5) * 2.2 + 0.5));
    pixels[index * 4 + 3] = Math.round((1 - depth * (1 - contrast)) * 255);
  }
}
