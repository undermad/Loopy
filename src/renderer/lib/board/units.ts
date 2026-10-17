import type { Board, BoardUnit } from '@shared/board';

export type BoardUnits = Pick<Board, 'unit' | 'unitScale'>;

export interface GridLevel {
  flowGap: number;
  gap: number;
  width: number;
  opacity: number;
}

export const BOARD_UNITS: readonly BoardUnit[] = ['px', 'mm', 'cm', 'm', 'km'];

export const GRID_MIN_SCREEN_GAP = 12;

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
  const exponent = Math.ceil(Math.log10(GRID_MIN_SCREEN_GAP / (base * safeZoom)));
  return Number((base * 10 ** exponent).toPrecision(12));
}

export function gridLevels(board: BoardUnits, zoom: number): GridLevel[] {
  const safeZoom = zoom > 0 ? zoom : 1;
  const fine = gridStep(board, safeZoom);
  const fineGap = fine * safeZoom;
  const fade = Math.min(1, Math.max(0, (fineGap - GRID_MIN_SCREEN_GAP) / (GRID_MIN_SCREEN_GAP * 9)));
  return [
    { flowGap: fine, gap: fineGap, width: 1, opacity: 0.5 * fade },
    { flowGap: fine * 10, gap: fineGap * 10, width: 1 + fade, opacity: 0.5 + 0.3 * fade },
    { flowGap: fine * 100, gap: fineGap * 100, width: 2 + 0.5 * fade, opacity: 0.8 + 0.2 * fade },
  ];
}

export function snapToStep(value: number, step: number): number {
  return step > 0 ? Math.round(value / step) * step : value;
}
