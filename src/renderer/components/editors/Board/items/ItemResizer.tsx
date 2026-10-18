import { useRef, type PointerEvent } from 'react';
import { useStore } from '@xyflow/react';
import {
  RESIZE_HANDLES,
  resizeCursor,
  resizeRect,
  type Point,
  type Rect,
  type ResizeHandle,
} from '@renderer/lib/board';
import { cx } from '@renderer/ui';
import styles from './ItemFrame.module.scss';

interface Session {
  pointerId: number;
  handle: ResizeHandle;
  start: Point;
  zoom: number;
  base: Rect;
}

export interface ItemResizerProps {
  rect: Rect;
  rotation: number;
  keepRatio: boolean;
  snapping: boolean;
  gridStep: (zoom: number) => number;
  onStart: () => void;
  onPreview: (rect: Rect | null) => void;
  onCommit: (rect: Rect) => void;
}

export function ItemResizer({
  rect,
  rotation,
  keepRatio,
  snapping,
  gridStep,
  onStart,
  onPreview,
  onCommit,
}: ItemResizerProps) {
  const zoom = useStore((state) => state.transform[2]);
  const session = useRef<Session | null>(null);

  function plan(current: Session, event: PointerEvent<HTMLDivElement>): Rect {
    const delta = {
      x: (event.clientX - current.start.x) / current.zoom,
      y: (event.clientY - current.start.y) / current.zoom,
    };
    const snap = snapping || event.ctrlKey || event.metaKey;
    const step = gridStep(current.zoom);
    return resizeRect(current.base, rotation, current.handle, delta, {
      keepRatio: keepRatio || event.shiftKey,
      step: snap ? step : null,
    });
  }

  function down(event: PointerEvent<HTMLDivElement>, handle: ResizeHandle) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    session.current = {
      pointerId: event.pointerId,
      handle,
      start: { x: event.clientX, y: event.clientY },
      zoom: zoom || 1,
      base: rect,
    };
    onStart();
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const current = session.current;
    if (current?.pointerId !== event.pointerId) return;
    onPreview(plan(current, event));
  }

  function up(event: PointerEvent<HTMLDivElement>) {
    const current = session.current;
    if (current?.pointerId !== event.pointerId) return;
    session.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const next = plan(current, event);
    onPreview(null);
    const base = current.base;
    const changed =
      next.x !== base.x || next.y !== base.y || next.width !== base.width || next.height !== base.height;
    if (changed) onCommit(next);
  }

  return (
    <>
      {RESIZE_HANDLES.map((handle) => (
        <div
          key={handle}
          className={cx(
            'nodrag nopan',
            handle.length === 2 ? styles['resizeHandle'] : styles['resizeEdge'],
            styles[`handle${handle.charAt(0).toUpperCase()}${handle.slice(1)}`],
          )}
          data-resize={handle}
          style={{ cursor: resizeCursor(handle, rotation) }}
          aria-hidden="true"
          onPointerDown={(event) => {
            down(event, handle);
          }}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => {
            session.current = null;
            onPreview(null);
          }}
        />
      ))}
    </>
  );
}
