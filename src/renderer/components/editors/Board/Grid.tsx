import { useId } from 'react';
import { useStore } from '@xyflow/react';
import type { Board } from '@shared/board';
import { gridLevels } from '@renderer/lib/board';
import styles from './BoardEditor.module.scss';

export type GridBoard = Pick<Board, 'unit' | 'unitScale' | 'gridColor'>;

function wrap(value: number, gap: number): number {
  return ((value % gap) + gap) % gap;
}

export function Grid({ board }: { board: GridBoard }) {
  const transform = useStore((state) => state.transform);
  const [tx, ty, zoom] = transform;
  const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const levels = gridLevels(board, zoom);

  return (
    <svg
      className={`react-flow__background ${styles['grid'] ?? ''}`}
      data-testid="board-grid"
      aria-hidden="true"
    >
      <defs>
        {levels.map((level, index) => (
          <pattern
            key={index}
            id={`${prefix}-${String(index)}`}
            x={wrap(tx - level.gap / 2, level.gap)}
            y={wrap(ty - level.gap / 2, level.gap)}
            width={level.gap}
            height={level.gap}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M${String(level.gap / 2)} 0 V${String(level.gap)} M0 ${String(level.gap / 2)} H${String(level.gap)}`}
              fill="none"
              stroke={board.gridColor}
              strokeWidth={level.width}
              strokeOpacity={level.opacity}
              data-level={index}
            />
          </pattern>
        ))}
      </defs>
      {levels.map((_, index) => (
        <rect key={index} width="100%" height="100%" fill={`url(#${prefix}-${String(index)})`} />
      ))}
      <line x1={tx} y1="0" x2={tx} y2="100%" stroke={board.gridColor} strokeWidth={2} strokeOpacity={0.9} />
      <line x1="0" y1={ty} x2="100%" y2={ty} stroke={board.gridColor} strokeWidth={2} strokeOpacity={0.9} />
    </svg>
  );
}
