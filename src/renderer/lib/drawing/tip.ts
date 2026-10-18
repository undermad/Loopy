import type { BrushSettings } from '@shared/brushes';
import type { Rgb } from '@renderer/lib/colour';

export interface TipShape {
  tip: BrushSettings['tip'];
  hardness: number;
  roundness: number;
  angle: number;
}

export function tipAlpha(u: number, v: number, shape: Pick<TipShape, 'tip' | 'hardness'>): number {
  const distance = shape.tip === 'square' ? Math.max(Math.abs(u), Math.abs(v)) : Math.hypot(u, v);
  if (distance >= 1) return 0;
  const edge = Math.min(0.98, Math.max(0, shape.hardness));
  if (distance <= edge) return 1;
  const t = (distance - edge) / (1 - edge);
  return 1 - t * t * (3 - 2 * t);
}

export function quantiseDiameter(diameter: number): number {
  if (diameter <= 8) return Math.max(1, Math.ceil(diameter));
  return Math.round(8 * 1.06 ** Math.round(Math.log(diameter / 8) / Math.log(1.06)));
}

export function tipKey(shape: TipShape, diameter: number, colour: string): string {
  return [
    shape.tip,
    Math.round(shape.hardness * 20),
    Math.round(shape.roundness * 20),
    Math.round(shape.angle / 3) % 120,
    diameter,
    colour,
  ].join('|');
}

export function tipBounds(diameter: number): number {
  return Math.ceil(diameter) + 2;
}

export function paintTip(
  pixels: Uint8ClampedArray,
  side: number,
  diameter: number,
  shape: TipShape,
  rgb: Rgb,
): void {
  const radius = diameter / 2;
  const centre = side / 2;
  const turn = (-shape.angle * Math.PI) / 180;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const squash = Math.max(0.05, shape.roundness);
  const samples = diameter < 6 ? 4 : 1;
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      let total = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples - centre;
          const py = y + (sy + 0.5) / samples - centre;
          const u = (px * cos - py * sin) / radius;
          const v = (px * sin + py * cos) / (radius * squash);
          total += tipAlpha(u, v, shape);
        }
      }
      const index = (y * side + x) * 4;
      pixels[index] = rgb.r;
      pixels[index + 1] = rgb.g;
      pixels[index + 2] = rgb.b;
      pixels[index + 3] = Math.round((total / (samples * samples)) * 255);
    }
  }
}
