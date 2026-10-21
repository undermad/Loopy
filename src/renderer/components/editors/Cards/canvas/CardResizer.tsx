import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from '@renderer/lib/i18n';
import { cx } from '@renderer/ui';
import styles from './Canvas.module.scss';

export interface CardSize {
  width: number;
  height: number;
}

type Axis = 'width' | 'height' | 'both';

const STEP = 10;
const LIMITS = { width: [120, 2000], height: [80, 4000] } as const;

function clampSize(size: CardSize): CardSize {
  const clamp = (value: number, [low, high]: readonly [number, number]) =>
    Math.min(high, Math.max(low, Math.round(value)));
  return { width: clamp(size.width, LIMITS.width), height: clamp(size.height, LIMITS.height) };
}

interface Session {
  pointerId: number;
  axis: Axis;
  x: number;
  y: number;
  base: CardSize;
}

export function CardResizer({
  size,
  zoom,
  onPreview,
  onCommit,
}: {
  size: CardSize;
  zoom: number;
  onPreview: (size: CardSize | null) => void;
  onCommit: (size: CardSize) => void;
}) {
  const { t } = useTranslation('editors');
  const session = useRef<Session | null>(null);
  const [dragging, setDragging] = useState<CardSize | null>(null);

  function begin(axis: Axis, event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    session.current = { pointerId: event.pointerId, axis, x: event.clientX, y: event.clientY, base: size };
    const handle = event.currentTarget;
    if ('setPointerCapture' in handle) handle.setPointerCapture(event.pointerId);
  }

  function measure(event: PointerEvent<HTMLDivElement>): CardSize | null {
    const own = session.current;
    if (own?.pointerId !== event.pointerId) return null;
    const snap = (value: number) => (event.altKey ? value : Math.round(value / STEP) * STEP);
    return clampSize({
      width: own.axis === 'height' ? own.base.width : snap(own.base.width + (event.clientX - own.x) / zoom),
      height: own.axis === 'width' ? own.base.height : snap(own.base.height + (event.clientY - own.y) / zoom),
    });
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const next = measure(event);
    if (!next) return;
    setDragging(next);
    onPreview(next);
  }

  function end(event: PointerEvent<HTMLDivElement>) {
    const next = measure(event);
    const base = session.current?.base;
    session.current = null;
    setDragging(null);
    onPreview(null);
    if (next && base && (next.width !== base.width || next.height !== base.height)) onCommit(next);
  }

  function key(axis: Axis, event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 1 : STEP;
    const moves: Record<string, Partial<CardSize>> = {
      ArrowRight: axis === 'height' ? {} : { width: size.width + step },
      ArrowLeft: axis === 'height' ? {} : { width: size.width - step },
      ArrowDown: axis === 'width' ? {} : { height: size.height + step },
      ArrowUp: axis === 'width' ? {} : { height: size.height - step },
    };
    const change = moves[event.key];
    if (!change || Object.keys(change).length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    onCommit(clampSize({ ...size, ...change }));
  }

  const handle = (axis: Axis, label: string, className: string | undefined) => (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={axis === 'height' ? LIMITS.height[0] : LIMITS.width[0]}
      aria-valuemax={axis === 'height' ? LIMITS.height[1] : LIMITS.width[1]}
      aria-valuenow={axis === 'height' ? size.height : size.width}
      aria-valuetext={`${String(size.width)} × ${String(size.height)}`}
      className={cx(styles['cardHandle'], className)}
      onPointerDown={(event) => {
        begin(axis, event);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onClick={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        key(axis, event);
      }}
    />
  );

  return (
    <>
      {handle('width', t('cards.resizeCardWidth'), styles['cardHandleWidth'])}
      {handle('height', t('cards.resizeCardHeight'), styles['cardHandleHeight'])}
      {handle('both', t('cards.resizeCard'), styles['cardHandleCorner'])}
      {dragging ? (
        <span className={styles['cardBadge']} aria-hidden="true">
          {`${String(dragging.width)} × ${String(dragging.height)}`}
        </span>
      ) : null}
    </>
  );
}
