import { useId } from 'react';
import { useStore } from '@xyflow/react';
import type { Board } from '@shared/board';
import { gridLevels, type GridLevel } from '@renderer/lib/board';
import styles from './BoardEditor.module.scss';

export type GridBoard = Pick<Board, 'unit' | 'unitScale' | 'gridColor'>;

function wrap(value: number, gap: number): number {
  return ((value % gap) + gap) % gap;
}

export function crisp(position: number, width: number): number {
  return Math.round(position) - (width % 2 === 1 ? 0.5 : 0);
}

export function linePositions(offset: number, gap: number, extent: number): number[] {
  if (gap <= 0 || extent <= 0) return [];
  const positions: number[] = [];
  for (let k = Math.floor(-offset / gap); k <= Math.ceil((extent - offset) / gap); k += 1) {
    positions.push(offset + k * gap);
  }
  return positions;
}

function CrispLines({ level, tx, ty, width, height, color }: GridLevelLinesProps) {
  const stroke = Math.max(1, Math.round(level.width));
  return (
    <g stroke={color} strokeWidth={stroke} strokeOpacity={level.opacity} data-level="lines">
      {linePositions(tx, level.gap, width).map((x) => {
        const at = crisp(x, stroke);
        return <line key={`x${String(x)}`} x1={at} y1={0} x2={at} y2={height} />;
      })}
      {linePositions(ty, level.gap, height).map((y) => {
        const at = crisp(y, stroke);
        return <line key={`y${String(y)}`} x1={0} y1={at} x2={width} y2={at} />;
      })}
    </g>
  );
}

interface GridLevelLinesProps {
  level: GridLevel;
  tx: number;
  ty: number;
  width: number;
  height: number;
  color: string;
}

export function Grid({ board }: { board: GridBoard }) {
  const transform = useStore((state) => state.transform);
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const [tx, ty, zoom] = transform;
  const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [fine, ...crispLevels] = gridLevels(board, zoom);
  if (!fine) return null;

  return (
    <svg
      className={`react-flow__background ${styles['grid'] ?? ''}`}
      data-testid="board-grid"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={prefix}
          x={wrap(tx - fine.gap / 2, fine.gap)}
          y={wrap(ty - fine.gap / 2, fine.gap)}
          width={fine.gap}
          height={fine.gap}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M${String(fine.gap / 2)} 0 V${String(fine.gap)} M0 ${String(fine.gap / 2)} H${String(fine.gap)}`}
            fill="none"
            stroke={board.gridColor}
            strokeWidth={fine.width}
            strokeOpacity={fine.opacity}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${prefix})`} />
      {crispLevels.map((level, index) => (
        <CrispLines
          key={index}
          level={level}
          tx={tx}
          ty={ty}
          width={width}
          height={height}
          color={board.gridColor}
        />
      ))}
      <g stroke={board.gridColor} strokeWidth={2} strokeOpacity={0.9}>
        <line x1={crisp(tx, 2)} y1={0} x2={crisp(tx, 2)} y2={height} />
        <line x1={0} y1={crisp(ty, 2)} x2={width} y2={crisp(ty, 2)} />
      </g>
    </svg>
  );
}
