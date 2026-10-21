import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { CARD_COLUMNS, CARD_MIN_FIELD_HEIGHT, type CardField } from '@shared/cards';
import { clampSpan, snapHeight, spanFromPixels } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { cx } from '@renderer/ui';
import { useCanvas } from './context';
import styles from './Canvas.module.scss';

const HEIGHT_STEP = 8;

interface Session {
  pointerId: number;
  axis: 'width' | 'height';
  startX: number;
  startY: number;
  width: number;
  height: number;
  grid: number;
}

function rectOf(element: Element | null): DOMRect {
  return element?.getBoundingClientRect() ?? new DOMRect();
}

export function FieldResizer({ field, label }: { field: CardField; label: string }) {
  const { t } = useTranslation('editors');
  const canvas = useCanvas();
  const session = useRef<Session | null>(null);
  const preview = canvas.resizing?.id === field.id ? canvas.resizing : null;
  const span = preview?.span ?? field.span;

  function begin(axis: Session['axis'], event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    const frame = event.currentTarget.closest('[data-field-id]');
    const zone = event.currentTarget.closest('[data-zone]');
    const own = rectOf(frame);
    session.current = {
      pointerId: event.pointerId,
      axis,
      startX: event.clientX,
      startY: event.clientY,
      width: own.width,
      height: own.height,
      grid: rectOf(zone).width,
    };
    const handle = event.currentTarget;
    if ('setPointerCapture' in handle) handle.setPointerCapture(event.pointerId);
    canvas.setResizing({ id: field.id, span: field.span, height: field.height });
  }

  function measure(event: PointerEvent<HTMLDivElement>) {
    const own = session.current;
    if (own?.pointerId !== event.pointerId) return null;
    if (own.axis === 'width') {
      const next = spanFromPixels(own.width + event.clientX - own.startX, own.grid, canvas.gap);
      return { id: field.id, span: next, height: field.height };
    }
    const next = snapHeight(own.height + event.clientY - own.startY, !event.altKey);
    return { id: field.id, span: field.span, height: next };
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const next = measure(event);
    if (next) canvas.setResizing(next);
  }

  function end(event: PointerEvent<HTMLDivElement>) {
    const next = measure(event);
    session.current = null;
    canvas.setResizing(null);
    if (!next) return;
    const changed = { ...field, span: next.span, height: next.height };
    if (changed.span !== field.span || changed.height !== field.height) canvas.change(changed);
  }

  function widthKey(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = {
      ArrowRight: field.span + 1,
      ArrowUp: field.span + 1,
      ArrowLeft: field.span - 1,
      ArrowDown: field.span - 1,
      Home: 1,
      End: CARD_COLUMNS,
    };
    const next = steps[event.key];
    if (next === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    canvas.change({ ...field, span: clampSpan(next) }, `span:${field.id}`);
  }

  function heightKey(event: KeyboardEvent<HTMLDivElement>) {
    const current = field.height ?? CARD_MIN_FIELD_HEIGHT;
    const steps: Record<string, number | null> = {
      ArrowDown: current + HEIGHT_STEP,
      ArrowRight: current + HEIGHT_STEP,
      ArrowUp: current - HEIGHT_STEP,
      ArrowLeft: current - HEIGHT_STEP,
      Home: null,
      Delete: null,
      Backspace: null,
    };
    if (!(event.key in steps)) return;
    event.preventDefault();
    event.stopPropagation();
    const next = steps[event.key] ?? null;
    canvas.change({ ...field, height: next === null ? null : snapHeight(next) }, `height:${field.id}`);
  }

  const handlers = {
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
    onClick: (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
    },
  };

  return (
    <>
      <div
        role="slider"
        tabIndex={0}
        aria-label={t('cards.resizeWidth', { label })}
        aria-valuemin={1}
        aria-valuemax={CARD_COLUMNS}
        aria-valuenow={span}
        aria-orientation="horizontal"
        className={cx(styles['handle'], styles['handleWidth'])}
        onPointerDown={(event) => {
          begin('width', event);
        }}
        onKeyDown={widthKey}
        {...handlers}
      />
      <div
        role="slider"
        tabIndex={0}
        aria-label={t('cards.resizeHeight', { label })}
        aria-valuemin={0}
        aria-valuemax={2000}
        aria-valuenow={preview?.height ?? field.height ?? 0}
        aria-orientation="vertical"
        className={cx(styles['handle'], styles['handleHeight'])}
        onPointerDown={(event) => {
          begin('height', event);
        }}
        onKeyDown={heightKey}
        {...handlers}
      />
      {preview ? (
        <span className={styles['badge']} aria-hidden="true">
          {preview.span === field.span && preview.height !== field.height
            ? `${String(preview.height ?? 0)} px`
            : `${String(span)}/${String(CARD_COLUMNS)}`}
        </span>
      ) : null}
    </>
  );
}
