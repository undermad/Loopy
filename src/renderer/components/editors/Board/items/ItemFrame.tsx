import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { Handle, NodeResizer, Position } from '@xyflow/react';
import { Lock } from 'lucide-react';
import { MIN_ITEM_SIZE, type BoardNode, type ItemStyle } from '@shared/board';
import { resolveItemStyle, type ResolvedStyle } from '@renderer/lib/board';
import { readableTextColour } from '@renderer/lib/colour';
import { useResolvedColour } from '@renderer/lib/palettes';
import { cx } from '@renderer/ui';
import { useBoardActions } from '../BoardContext';
import styles from './ItemFrame.module.scss';

export interface FrameColours {
  style: ResolvedStyle;
  fill: string | null;
  stroke: string | null;
  text: string;
}

export interface ItemFrameProps {
  node: BoardNode;
  label: string;
  selected: boolean;
  dragging: boolean;
  width: number;
  height: number;
  layers?: (ItemStyle | undefined)[];
  className?: string | undefined;
  onDoubleClick?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  overlay?: ReactNode;
  children: (colours: FrameColours) => ReactNode;
}

const HANDLES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
] as const;

function dashArray(style: ResolvedStyle): string | undefined {
  const width = Math.max(1, style.strokeWidth);
  if (style.strokeStyle === 'dashed') return `${String(width * 3)} ${String(width * 2)}`;
  if (style.strokeStyle === 'dotted') return `0 ${String(width * 2)}`;
  return undefined;
}

function clipFor(style: ResolvedStyle, width: number, height: number): CSSProperties {
  if (style.shape === 'ellipse') return { clipPath: 'ellipse(50% 50% at 50% 50%)' };
  if (style.shape === 'diamond') return { clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)' };
  if (style.shape === 'pill') return { borderRadius: Math.min(width, height) / 2 };
  if (style.shape === 'rounded') return { borderRadius: Math.max(style.radius, 12) };
  return { borderRadius: style.radius };
}

interface ShapeProps {
  style: ResolvedStyle;
  width: number;
  height: number;
  fill: string | null;
  stroke: string | null;
}

function Shape({ style, width, height, fill, stroke }: ShapeProps) {
  const strokeWidth = stroke ? style.strokeWidth : 0;
  const inset = strokeWidth / 2;
  const w = Math.max(0, width - strokeWidth);
  const h = Math.max(0, height - strokeWidth);
  const paint = {
    fill: fill ?? 'none',
    stroke: stroke ?? 'none',
    strokeWidth,
    strokeDasharray: dashArray(style),
    strokeLinecap: style.strokeStyle === 'dotted' ? ('round' as const) : ('butt' as const),
    strokeLinejoin: 'round' as const,
  };
  let shape: ReactNode;
  if (style.shape === 'ellipse') {
    shape = <ellipse cx={width / 2} cy={height / 2} rx={w / 2} ry={h / 2} {...paint} />;
  } else if (style.shape === 'diamond') {
    const points = [
      [width / 2, inset],
      [width - inset, height / 2],
      [width / 2, height - inset],
      [inset, height / 2],
    ]
      .map(([x, y]) => `${String(x)},${String(y)}`)
      .join(' ');
    shape = <polygon points={points} {...paint} />;
  } else {
    const radius =
      style.shape === 'pill'
        ? Math.min(w, h) / 2
        : style.shape === 'rounded'
          ? Math.max(style.radius, 12)
          : style.radius;
    shape = <rect x={inset} y={inset} width={w} height={h} rx={radius} ry={radius} {...paint} />;
  }
  return (
    <svg
      className={cx(styles['shape'], style.shadow && styles['shadow'])}
      width={width}
      height={height}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      aria-hidden="true"
    >
      {shape}
    </svg>
  );
}

export function ItemFrame({
  node,
  label,
  selected,
  dragging,
  width,
  height,
  layers = [],
  className,
  overlay,
  onDoubleClick,
  onKeyDown,
  children,
}: ItemFrameProps) {
  const actions = useBoardActions();
  const own = (node.data['style'] ?? {}) as ItemStyle;
  const style = resolveItemStyle(node.type, ...layers, own);
  const fill = useResolvedColour(style.fill);
  const stroke = useResolvedColour(style.stroke);
  const textOverride = useResolvedColour(style.textColour);
  const text = textOverride ?? (fill ? readableTextColour(fill) : actions.textColour);
  const locked = node.data['locked'] === true;
  const justify = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[style.verticalAlign];

  return (
    <div
      className={cx(
        styles['frame'],
        selected && styles['selected'],
        dragging && styles['dragging'],
        locked && styles['locked'],
        !selected && actions.dockedPeers.has(node.id) && styles['dockedPeer'],
        className,
      )}
      style={{ opacity: style.opacity }}
      aria-label={label}
      role="group"
      tabIndex={0}
      data-shape={style.shape}
      data-fill={fill ?? undefined}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
    >
      <NodeResizer
        isVisible={selected && !locked}
        minWidth={MIN_ITEM_SIZE.width}
        minHeight={MIN_ITEM_SIZE.height}
        lineClassName={styles['resizeLine'] ?? ''}
        handleClassName={styles['resizeHandle'] ?? ''}
      />
      <Shape style={style} width={width} height={height} fill={fill} stroke={stroke} />
      <div
        className={styles['content']}
        style={{
          ...clipFor(style, width, height),
          padding: style.padding,
          color: text,
          fontSize: style.fontSize,
          fontWeight: { normal: 400, medium: 500, bold: 700 }[style.fontWeight],
          textAlign: style.align,
          justifyContent: justify,
        }}
      >
        {children({ style, fill, stroke, text })}
      </div>
      {HANDLES.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type="source"
          position={handle.position}
          className={styles['handle']}
          isConnectable={!locked}
        />
      ))}
      {locked ? <Lock aria-hidden="true" className={styles['lock']} /> : null}
      {overlay}
    </div>
  );
}
