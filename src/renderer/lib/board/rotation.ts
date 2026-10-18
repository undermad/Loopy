import type { Point } from './items';

const ROTATION_STEP = 15;

export function normaliseAngle(angle: number): number {
  const turned = angle % 360;
  const positive = turned < 0 ? turned + 360 : turned;
  return Math.round(positive * 100) / 100;
}

export function snapAngle(angle: number, step = ROTATION_STEP): number {
  return normaliseAngle(Math.round(angle / step) * step);
}

function pointerAngle(centre: Point, pointer: Point): number {
  return (Math.atan2(pointer.y - centre.y, pointer.x - centre.x) * 180) / Math.PI;
}

export function rotateBy(base: number, centre: Point, from: Point, to: Point, snapping: boolean): number {
  const angle = base + pointerAngle(centre, to) - pointerAngle(centre, from);
  return snapping ? snapAngle(angle) : normaliseAngle(angle);
}

export function rotationOf(data: Record<string, unknown>): number {
  const rotation = data['rotation'];
  return typeof rotation === 'number' && Number.isFinite(rotation) ? rotation : 0;
}

export function rotateVector(vector: Point, degrees: number): Point {
  if (!degrees) return vector;
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: vector.x * cos - vector.y * sin, y: vector.x * sin + vector.y * cos };
}

export function rotatePoint(point: Point, pivot: Point, degrees: number): Point {
  const turned = rotateVector({ x: point.x - pivot.x, y: point.y - pivot.y }, degrees);
  return { x: pivot.x + turned.x, y: pivot.y + turned.y };
}
