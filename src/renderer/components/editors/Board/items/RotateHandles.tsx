import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { rotateBy, type Point } from '@renderer/lib/board';
import { cx } from '@renderer/ui';
import styles from './ItemFrame.module.scss';

const CORNERS = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const;

interface Session {
  pointerId: number;
  base: number;
  centre: Point;
  from: Point;
  last: Point;
  ctrl: boolean;
}

export interface RotateHandlesProps {
  rotation: number;
  snapping: boolean;
  onPreview: (angle: number | null) => void;
  onCommit: (angle: number) => void;
}

export function RotateHandles({ rotation, snapping, onPreview, onCommit }: RotateHandlesProps) {
  const session = useRef<Session | null>(null);
  const [rotating, setRotating] = useState(false);
  const angle = (current: Session) =>
    rotateBy(current.base, current.centre, current.from, current.last, snapping || current.ctrl);

  useEffect(() => {
    if (!rotating) return;
    const key = (event: KeyboardEvent) => {
      const current = session.current;
      if (!current || event.key !== 'Control') return;
      current.ctrl = event.type === 'keydown';
      onPreview(angle(current));
    };
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', key);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', key);
    };
  });

  function down(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const frame = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!frame) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = { x: event.clientX, y: event.clientY };
    session.current = {
      pointerId: event.pointerId,
      base: rotation,
      centre: { x: frame.left + frame.width / 2, y: frame.top + frame.height / 2 },
      from: point,
      last: point,
      ctrl: event.ctrlKey || event.metaKey,
    };
    setRotating(true);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const current = session.current;
    if (current?.pointerId !== event.pointerId) return;
    current.last = { x: event.clientX, y: event.clientY };
    current.ctrl = event.ctrlKey || event.metaKey;
    onPreview(angle(current));
  }

  function up(event: PointerEvent<HTMLDivElement>) {
    const current = session.current;
    if (current?.pointerId !== event.pointerId) return;
    session.current = null;
    setRotating(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    current.last = { x: event.clientX, y: event.clientY };
    const next = angle(current);
    onPreview(null);
    if (next !== current.base) onCommit(next);
  }

  return CORNERS.map((corner) => (
    <div
      key={corner}
      className={cx('nodrag nopan', styles['rotate'], styles[corner])}
      data-rotate={corner}
      aria-hidden="true"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => {
        session.current = null;
        setRotating(false);
        onPreview(null);
      }}
    />
  ));
}
