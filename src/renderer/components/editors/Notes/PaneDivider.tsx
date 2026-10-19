import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import styles from './NoteEditor.module.scss';

const MIN = 0.2;
const MAX = 0.8;
const STEP = 0.05;

export function clampRatio(value: number): number {
  return Math.round(Math.min(MAX, Math.max(MIN, value)) * 100) / 100;
}

interface PaneDividerProps {
  ratio: number;
  label: string;
  onPreview: (ratio: number | null) => void;
  onCommit: (ratio: number) => void;
}

export function PaneDivider({ ratio, label, onPreview, onCommit }: PaneDividerProps) {
  const drag = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  function ratioAt(event: PointerEvent<HTMLDivElement>): number {
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect || rect.width === 0) return ratio;
    return clampRatio((event.clientX - rect.left) / rect.width);
  }

  function finish(event: PointerEvent<HTMLDivElement>) {
    if (drag.current !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onPreview(null);
    onCommit(ratioAt(event));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next =
      event.key === 'ArrowLeft'
        ? ratio - STEP
        : event.key === 'ArrowRight'
          ? ratio + STEP
          : event.key === 'Home'
            ? MIN
            : event.key === 'End'
              ? MAX
              : null;
    if (next === null) return;
    event.preventDefault();
    onCommit(clampRatio(next));
  }

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={MIN * 100}
      aria-valuemax={MAX * 100}
      aria-valuenow={Math.round(ratio * 100)}
      className={styles['divider']}
      data-dragging={dragging || undefined}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = event.pointerId;
        setDragging(true);
      }}
      onPointerMove={(event) => {
        if (drag.current !== event.pointerId) return;
        onPreview(ratioAt(event));
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
    />
  );
}
