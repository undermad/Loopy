import { useEffect, useRef, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  Position,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';
import type { BoardEdge, EdgeMarker } from '@shared/board';
import { edgeData } from '@renderer/lib/board';
import { useTranslation } from '@renderer/lib/i18n';
import { useResolvedColour } from '@renderer/lib/palettes';
import { cx } from '@renderer/ui';
import { useBoardActions } from './BoardContext';
import styles from './ArrowEdge.module.scss';

export type ArrowFlowEdge = Edge<{ edge: BoardEdge }>;

const DEFAULT_COLOUR = '#64748b';
const MARKER_SIZE = 5;

function markerLength(kind: EdgeMarker, width: number): number {
  return kind === 'arrowClosed' ? MARKER_SIZE * width : 0;
}

function shift(x: number, y: number, position: Position, distance: number): [number, number] {
  if (position === Position.Left) return [x - distance, y];
  if (position === Position.Right) return [x + distance, y];
  if (position === Position.Top) return [x, y - distance];
  return [x, y + distance];
}

function Marker({ id, kind, colour }: { id: string; kind: EdgeMarker; colour: string }) {
  if (kind === 'none') return null;
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX={{ arrowClosed: 0, arrow: 9, circle: 5 }[kind]}
      refY={5}
      markerWidth={MARKER_SIZE}
      markerHeight={MARKER_SIZE}
      markerUnits="strokeWidth"
      orient="auto-start-reverse"
    >
      {kind === 'arrowClosed' ? <path d="M 0 0 L 10 5 L 0 10 z" fill={colour} /> : null}
      {kind === 'arrow' ? (
        <path
          d="M 1 1 L 9 5 L 1 9"
          fill="none"
          stroke={colour}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {kind === 'circle' ? <circle cx={5} cy={5} r={4} fill={colour} /> : null}
    </marker>
  );
}

export function ArrowEdge({
  id,
  data,
  selected,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps<ArrowFlowEdge>) {
  const { t } = useTranslation('editors');
  const actions = useBoardActions();
  const edge = data?.edge;
  const style = edgeData(edge ?? { data: {} });
  const colour = useResolvedColour(style.colour) ?? DEFAULT_COLOUR;
  const [local, setLocal] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const editing = local || actions.editingId === id;

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const [startX, startY] = shift(
    sourceX,
    sourceY,
    sourcePosition,
    markerLength(style.startMarker, style.width),
  );
  const [endX, endY] = shift(targetX, targetY, targetPosition, markerLength(style.endMarker, style.width));
  const geometry = {
    sourceX: startX,
    sourceY: startY,
    targetX: endX,
    targetY: endY,
    sourcePosition,
    targetPosition,
  };
  const [path, labelX, labelY] =
    style.path === 'straight'
      ? getStraightPath(geometry)
      : style.path === 'step'
        ? getSmoothStepPath({ ...geometry, borderRadius: 0 })
        : style.path === 'smoothstep'
          ? getSmoothStepPath({ ...geometry, borderRadius: 12 })
          : getBezierPath(geometry);
  const dash =
    style.dash === 'dashed'
      ? `${String(style.width * 4)} ${String(style.width * 3)}`
      : style.dash === 'dotted'
        ? `0 ${String(style.width * 2.5)}`
        : undefined;
  const startId = `${id}-start`;
  const endId = `${id}-end`;

  function commit() {
    setLocal(false);
    if (actions.editingId === id) actions.setEditingId(null);
    if (edge && draft !== null && draft !== style.label) {
      actions.updateEdge({ ...edge, data: { ...edge.data, label: draft.slice(0, 200) } });
    }
    setDraft(null);
  }

  return (
    <>
      <defs>
        <Marker id={startId} kind={style.startMarker} colour={colour} />
        <Marker id={endId} kind={style.endMarker} colour={colour} />
      </defs>
      {selected ? (
        <path d={path} className={styles['halo']} style={{ strokeWidth: style.width + 6 }} fill="none" />
      ) : null}
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={18}
        {...(style.startMarker === 'none' ? {} : { markerStart: `url(#${startId})` })}
        {...(style.endMarker === 'none' ? {} : { markerEnd: `url(#${endId})` })}
        className={cx(style.animated && styles['animated'])}
        style={{
          stroke: colour,
          strokeWidth: style.width,
          strokeDasharray: style.animated ? `${String(style.width * 4)} ${String(style.width * 3)}` : dash,
          strokeLinecap: style.dash === 'dotted' ? 'round' : 'butt',
        }}
      />
      {editing || style.label ? (
        <EdgeLabelRenderer>
          <div
            className={cx('nodrag nopan', styles['label'], selected && styles['labelSelected'])}
            style={{
              transform: `translate(-50%, -50%) translate(${String(labelX)}px, ${String(labelY)}px)`,
              borderColor: colour,
            }}
            onDoubleClick={() => {
              setDraft(null);
              setLocal(true);
            }}
          >
            {editing ? (
              <input
                ref={input}
                className={styles['input']}
                value={draft ?? style.label}
                aria-label={t('board.edgeLabel')}
                onChange={(event) => {
                  setDraft(event.target.value);
                }}
                onBlur={commit}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === 'Enter' || event.key === 'Escape') {
                    event.preventDefault();
                    commit();
                  }
                }}
              />
            ) : (
              style.label
            )}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
