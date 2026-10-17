import { useRef, useState, type ComponentProps, type PointerEvent } from 'react';
import { cx } from '../cx';
import { useFieldContext } from '../Field/Field';
import type { Size } from '../types';
import styles from './NumberInput.module.scss';

export interface NumberInputProps extends Omit<
  ComponentProps<'input'>,
  'size' | 'value' | 'defaultValue' | 'onChange' | 'type' | 'min' | 'max' | 'step'
> {
  value: number | null;
  onValueChange: (value: number | null) => void;
  min?: number | undefined;
  max?: number | undefined;
  step?: number;
  digits?: number;
  nullable?: boolean;
  pixelsPerStep?: number;
  size?: Size;
  invalid?: boolean;
}

interface Drag {
  pointerId: number;
  start: number;
  startX: number;
  moved: boolean;
  emitted: number;
}

const DRAG_THRESHOLD = 3;

function format(value: number | null, digits: number): string {
  if (value === null) return '';
  const rounded = Number(value.toFixed(digits));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function clamp(value: number, min: number | undefined, max: number | undefined): number {
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
}

export function NumberInput({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  digits = 3,
  nullable = false,
  pixelsPerStep = 4,
  size = 'md',
  invalid,
  disabled,
  className,
  id,
  'aria-describedby': describedBy,
  onBlur,
  onKeyDown,
  ...rest
}: NumberInputProps) {
  const field = useFieldContext();
  const drag = useRef<Drag | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function commit() {
    if (draft === null) return;
    setDraft(null);
    if (draft.trim() === '') {
      if (nullable && value !== null) onValueChange(null);
      return;
    }
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) return;
    const next = clamp(parsed, min, max);
    if (format(next, digits) !== format(value, digits)) onValueChange(next);
  }

  function endDrag(event: PointerEvent<HTMLInputElement>) {
    const current = drag.current;
    if (current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!current.moved && event.type === 'pointerup') {
      event.currentTarget.focus();
      event.currentTarget.select();
    }
  }

  return (
    <input
      id={id ?? field?.id}
      aria-describedby={describedBy ?? field?.describedBy}
      aria-invalid={(invalid ?? field?.invalid) ? true : undefined}
      className={cx(styles['input'], styles[size], dragging && styles['dragging'], className)}
      type="number"
      inputMode="decimal"
      step={step}
      {...(min !== undefined ? { min } : {})}
      {...(max !== undefined ? { max } : {})}
      disabled={disabled}
      value={draft ?? format(value, digits)}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={(event) => {
        commit();
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === 'Escape' && draft !== null) {
          event.preventDefault();
          setDraft(null);
        }
      }}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0 || document.activeElement === event.currentTarget) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const start = value ?? clamp(0, min, max);
        drag.current = {
          pointerId: event.pointerId,
          start,
          startX: event.clientX,
          moved: false,
          emitted: start,
        };
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (current?.pointerId !== event.pointerId) return;
        const dx = event.clientX - current.startX;
        if (!current.moved) {
          if (Math.abs(dx) < DRAG_THRESHOLD) return;
          current.moved = true;
          setDragging(true);
          setDraft(null);
        }
        const increment = event.shiftKey ? step / 10 : step;
        const steps = Math.trunc(dx / pixelsPerStep);
        const next = clamp(Number((current.start + steps * increment).toFixed(digits)), min, max);
        if (next !== current.emitted) {
          current.emitted = next;
          onValueChange(next);
        }
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      {...rest}
    />
  );
}
