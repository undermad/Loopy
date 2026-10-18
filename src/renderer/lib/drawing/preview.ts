import { DEFAULT_BOARD_BACKGROUND } from '@shared/board';
import type { BrushSettings } from '@shared/brushes';
import { context2d, createTileCanvas } from './cache';
import { grainPattern, stampDabs, type PaintMode } from './engine';
import { createStroke, type Dab } from './stroke';

export function previewPath(width: number, height: number, steps = 48): { x: number; y: number }[] {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    return {
      x: width * (0.08 + 0.84 * t),
      y: height * (0.5 + 0.28 * Math.sin(t * Math.PI * 2)),
    };
  });
}

export function previewDabs(settings: BrushSettings, width: number, height: number, scale = 1): Dab[] {
  const stroke = createStroke(settings, scale, 7);
  const dabs = previewPath(width, height).flatMap((point, index, all) =>
    stroke.add({ ...point, pressure: Math.sin((index / (all.length - 1)) * Math.PI), tiltX: 0, tiltY: 0 }),
  );
  return [...dabs, ...stroke.finish()];
}

export function drawPreview(
  target: CanvasRenderingContext2D,
  settings: BrushSettings,
  colour: string,
  mode: PaintMode,
): void {
  const { width, height } = target.canvas;
  const size = Math.min(settings.size, height * 0.4);
  const fitted = { ...settings, size };
  const wet = createTileCanvas(width, height);
  const drawing = context2d(wet);
  stampDabs(drawing, previewDabs(fitted, width, height), fitted, colour, 'brush');
  const pattern = grainPattern(drawing, fitted, fitted.grainScale * 0.5, { x: 0, y: 0 });
  if (pattern) {
    drawing.globalCompositeOperation = 'destination-in';
    drawing.fillStyle = pattern;
    drawing.fillRect(0, 0, width, height);
  }
  target.clearRect(0, 0, width, height);
  if (mode === 'eraser') {
    target.fillStyle = colour;
    target.fillRect(0, height * 0.25, width, height * 0.5);
    target.globalCompositeOperation = 'destination-out';
  }
  target.globalAlpha = settings.opacity;
  target.drawImage(wet, 0, 0);
  target.globalAlpha = 1;
  target.globalCompositeOperation = 'destination-over';
  target.fillStyle = DEFAULT_BOARD_BACKGROUND;
  target.fillRect(0, 0, width, height);
  target.globalCompositeOperation = 'source-over';
}
