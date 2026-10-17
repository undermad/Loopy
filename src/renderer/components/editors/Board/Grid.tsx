import { ViewportPortal, useStore } from '@xyflow/react';
import type { Board } from '@shared/board';
import { gridLevels, type GridLevel } from '@renderer/lib/board';
import styles from './BoardEditor.module.scss';

export type GridBoard = Pick<Board, 'unit' | 'unitScale' | 'gridColor'>;

export function linePositions(gap: number, from: number, to: number): number[] {
  if (gap <= 0 || to <= from) return [];
  const positions: number[] = [];
  for (let k = Math.floor(from / gap); k <= Math.ceil(to / gap); k += 1) positions.push(k * gap);
  return positions;
}

interface LevelProps {
  level: GridLevel;
  rect: { x: number; y: number; width: number; height: number };
  color: string;
}

function Level({ level, rect, color }: LevelProps) {
  const stroke = Math.max(1, Math.round(level.width));
  return (
    <g
      stroke={color}
      strokeWidth={stroke}
      strokeOpacity={level.opacity}
      vectorEffect="non-scaling-stroke"
      data-level={String(level.flowGap)}
    >
      {linePositions(level.flowGap, rect.x, rect.x + rect.width).map((x) => (
        <line
          key={`x${String(x)}`}
          x1={x}
          y1={rect.y}
          x2={x}
          y2={rect.y + rect.height}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {linePositions(level.flowGap, rect.y, rect.y + rect.height).map((y) => (
        <line
          key={`y${String(y)}`}
          x1={rect.x}
          y1={y}
          x2={rect.x + rect.width}
          y2={y}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

export function Grid({ board }: { board: GridBoard }) {
  const transform = useStore((state) => state.transform);
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const [tx, ty, zoom] = transform;
  const safeZoom = zoom > 0 ? zoom : 1;
  const rect = { x: -tx / safeZoom, y: -ty / safeZoom, width: width / safeZoom, height: height / safeZoom };
  const levels = gridLevels(board, safeZoom);
  if (rect.width <= 0 || rect.height <= 0) return null;

  return (
    <ViewportPortal>
      <svg
        className={styles['grid']}
        data-testid="board-grid"
        aria-hidden="true"
        style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
        viewBox={`${String(rect.x)} ${String(rect.y)} ${String(rect.width)} ${String(rect.height)}`}
      >
        {levels.map((level) => (
          <Level key={level.flowGap} level={level} rect={rect} color={board.gridColor} />
        ))}
        <g stroke={board.gridColor} strokeWidth={2} strokeOpacity={0.9} data-level="axes">
          <line x1={0} y1={rect.y} x2={0} y2={rect.y + rect.height} vectorEffect="non-scaling-stroke" />
          <line x1={rect.x} y1={0} x2={rect.x + rect.width} y2={0} vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
    </ViewportPortal>
  );
}
