import { useMemo, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import type { PaletteColour } from '@shared/colours';
import { fromWheelHue, hexToHsv, hsvToHex, toWheelHue, type Hsv } from '@renderer/lib/colour';
import { useTranslation } from '@renderer/lib/i18n';
import { cx } from '@renderer/ui';
import styles from './ColourWheel.module.scss';

export interface ColourWheelProps {
  colours: PaletteColour[];
  selectedIndex: number;
  baseIndex: number;
  disabled?: boolean;
  onSelect: (index: number) => void;
  onChange: (index: number, hsv: Hsv) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

const HUE_STEP = 2;
const SATURATION_STEP = 0.02;
const DISC_VALUE = 0.96;
const DISC_STEPS = 36;

export function positionOf(hsv: Pick<Hsv, 'h' | 's'>): { x: number; y: number } {
  const angle = (-toWheelHue(hsv.h) * Math.PI) / 180;
  return { x: 0.5 + 0.5 * hsv.s * Math.cos(angle), y: 0.5 + 0.5 * hsv.s * Math.sin(angle) };
}

export function hsvAt(x: number, y: number): Pick<Hsv, 'h' | 's'> {
  const dx = x - 0.5;
  const dy = y - 0.5;
  const s = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2);
  const screenAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return { h: fromWheelHue(-screenAngle), s };
}

export function discGradient(): string {
  const stops: string[] = [];
  for (let step = 0; step <= DISC_STEPS; step += 1) {
    const screenAngle = (step * 360) / DISC_STEPS;
    const hex = hsvToHex({ h: fromWheelHue(-screenAngle), s: 1, v: DISC_VALUE });
    stops.push(`${hex} ${String(screenAngle)}deg`);
  }
  return `conic-gradient(from 90deg, ${stops.join(', ')})`;
}

export function ColourWheel({
  colours,
  selectedIndex,
  baseIndex,
  disabled = false,
  onSelect,
  onChange,
  onDragStart,
  onDragEnd,
}: ColourWheelProps) {
  const { t } = useTranslation('colours');
  const wheel = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);
  const gradient = useMemo(() => discGradient(), []);

  function relative(event: PointerEvent): { x: number; y: number } | null {
    const rect = wheel.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  }

  function move(index: number, event: PointerEvent) {
    const point = relative(event);
    const colour = colours[index];
    if (!point || !colour) return;
    const { h, s } = hsvAt(point.x, point.y);
    onChange(index, { h, s, v: hexToHsv(colour.hex).v });
  }

  function start(index: number, event: PointerEvent<HTMLElement>) {
    event.preventDefault();
    onSelect(index);
    if (disabled) return;
    dragging.current = index;
    event.currentTarget.setPointerCapture(event.pointerId);
    onDragStart?.();
  }

  function end(index: number, event: PointerEvent<HTMLElement>) {
    if (dragging.current !== index) return;
    dragging.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onDragEnd?.();
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLButtonElement>) {
    const colour = colours[index];
    if (!colour || disabled) return;
    const hsv = hexToHsv(colour.hex);
    const next = { ...hsv };
    if (event.key === 'ArrowLeft') next.h = fromWheelHue(toWheelHue(hsv.h) + HUE_STEP);
    else if (event.key === 'ArrowRight') next.h = fromWheelHue(toWheelHue(hsv.h) - HUE_STEP);
    else if (event.key === 'ArrowUp') next.s = Math.min(1, hsv.s + SATURATION_STEP);
    else if (event.key === 'ArrowDown') next.s = Math.max(0, hsv.s - SATURATION_STEP);
    else return;
    event.preventDefault();
    onChange(index, next);
  }

  return (
    <div
      ref={wheel}
      className={cx(styles['wheel'], disabled && styles['disabled'])}
      role="group"
      aria-label={t('wheel.label')}
      style={{ '--wheel-hues': gradient } as CSSProperties}
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return;
        start(baseIndex, event);
        move(baseIndex, event);
      }}
      onPointerMove={(event) => {
        if (dragging.current === baseIndex && event.target === event.currentTarget) move(baseIndex, event);
      }}
      onPointerUp={(event) => {
        if (event.target === event.currentTarget) end(baseIndex, event);
      }}
    >
      <svg className={styles['lines']} viewBox="0 0 100 100" aria-hidden="true">
        {colours.map((colour, index) => {
          const point = positionOf(hexToHsv(colour.hex));
          return (
            <line
              key={colour.id}
              x1={50}
              y1={50}
              x2={point.x * 100}
              y2={point.y * 100}
              className={cx(styles['line'], index === baseIndex && styles['baseLine'])}
            />
          );
        })}
      </svg>
      {colours.map((colour, index) => {
        const point = positionOf(hexToHsv(colour.hex));
        return (
          <button
            key={colour.id}
            type="button"
            aria-label={t('wheel.marker', { index: index + 1 })}
            aria-pressed={index === selectedIndex}
            data-base={index === baseIndex ? 'true' : undefined}
            className={cx(
              styles['marker'],
              index === baseIndex && styles['base'],
              index === selectedIndex && styles['selected'],
            )}
            style={{
              left: `${String(point.x * 100)}%`,
              top: `${String(point.y * 100)}%`,
              background: colour.hex,
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              start(index, event);
            }}
            onPointerMove={(event) => {
              if (dragging.current === index) move(index, event);
            }}
            onPointerUp={(event) => {
              end(index, event);
            }}
            onKeyDown={(event) => {
              onKeyDown(index, event);
            }}
            onFocus={() => {
              onSelect(index);
            }}
          />
        );
      })}
    </div>
  );
}
