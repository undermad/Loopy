import type { Board, BoardUnit } from '@shared/board';

export type BoardUnits = Pick<Board, 'unit' | 'unitScale'>;

export const BOARD_UNITS: readonly BoardUnit[] = ['px', 'mm', 'cm', 'm', 'km'];

const MIN_MINOR_SCREEN_GAP = 16;

export function toUnits(pixels: number, board: BoardUnits): number {
  return pixels / board.unitScale;
}

export function fromUnits(value: number, board: BoardUnits): number {
  return value * board.unitScale;
}

export function formatLength(pixels: number, board: BoardUnits, digits = 2): string {
  const value = toUnits(pixels, board);
  const rounded = Number(value.toFixed(digits));
  return `${String(Object.is(rounded, -0) ? 0 : rounded)} ${board.unit}`;
}

export function gridStep(board: BoardUnits, zoom: number): number {
  const base = board.unitScale;
  const safeZoom = zoom > 0 ? zoom : 1;
  const exponent = Math.ceil(Math.log10(MIN_MINOR_SCREEN_GAP / (base * safeZoom)));
  return Number((base * 10 ** exponent).toPrecision(12));
}

export function snapToStep(value: number, step: number): number {
  return step > 0 ? Math.round(value / step) * step : value;
}
