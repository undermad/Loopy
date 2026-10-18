import { MIN_ITEM_SIZE } from '@shared/board';
import type { Point, Rect } from './items';
import { rotateVector } from './rotation';

export type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export const RESIZE_HANDLES: readonly ResizeHandle[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

const DIRECTIONS: Record<ResizeHandle, number> = {
  e: 0,
  se: 45,
  s: 90,
  sw: 135,
  w: 180,
  nw: 225,
  n: 270,
  ne: 315,
};
const CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'] as const;

export interface ResizeOptions {
  keepRatio?: boolean;
  step?: number | null;
}

export function resizeCursor(handle: ResizeHandle, rotation: number): string {
  const angle = (((DIRECTIONS[handle] + rotation) % 180) + 180) % 180;
  return CURSORS[Math.round(angle / 45) % 4] ?? 'ew-resize';
}

export function resizeRect(
  rect: Rect,
  rotation: number,
  handle: ResizeHandle,
  delta: Point,
  options: ResizeOptions = {},
): Rect {
  const local = rotateVector(delta, -rotation);
  const west = handle.includes('w');
  const east = handle.includes('e');
  const north = handle.includes('n');
  const south = handle.includes('s');
  let width = rect.width + (east ? local.x : west ? -local.x : 0);
  let height = rect.height + (south ? local.y : north ? -local.y : 0);
  if (options.keepRatio && (east || west) && (north || south)) {
    const scale = Math.max(width / rect.width, height / rect.height);
    width = rect.width * scale;
    height = rect.height * scale;
  }
  const step = options.step;
  if (step && step > 0) {
    if (east || west) width = Math.round(width / step) * step;
    if (north || south) height = Math.round(height / step) * step;
  }
  width = Math.max(MIN_ITEM_SIZE.width, width);
  height = Math.max(MIN_ITEM_SIZE.height, height);
  const grownX = width - rect.width;
  const grownY = height - rect.height;
  const shift = rotateVector(
    { x: east ? grownX / 2 : west ? -grownX / 2 : 0, y: south ? grownY / 2 : north ? -grownY / 2 : 0 },
    rotation,
  );
  const centre = { x: rect.x + rect.width / 2 + shift.x, y: rect.y + rect.height / 2 + shift.y };
  return { x: centre.x - width / 2, y: centre.y - height / 2, width, height };
}
