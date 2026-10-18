import { useCallback, useRef, type ComponentProps, type PointerEvent } from 'react';
import { cx } from '../cx';
import styles from './ScrollStrip.module.scss';

export interface ScrollStripProps extends ComponentProps<'div'> {
  orientation?: 'horizontal' | 'vertical';
}

interface Pan {
  pointerId: number;
  start: number;
  offset: number;
}

function markOverflow(node: HTMLElement, horizontal: boolean) {
  const offset = horizontal ? node.scrollLeft : node.scrollTop;
  const max = horizontal ? node.scrollWidth - node.clientWidth : node.scrollHeight - node.clientHeight;
  const before = offset > 1;
  const after = offset < max - 1;
  node.dataset['more'] = before && after ? 'both' : before ? 'start' : after ? 'end' : '';
}

export function ScrollStrip({
  orientation = 'horizontal',
  className,
  ref,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onScroll,
  ...rest
}: ScrollStripProps) {
  const horizontal = orientation === 'horizontal';
  const pan = useRef<Pan | null>(null);
  const cleanup = useRef<(() => void) | null>(null);

  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      cleanup.current?.();
      cleanup.current = null;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
      if (!node) return;
      const wheel = (event: WheelEvent) => {
        if (event.ctrlKey) return;
        const max = horizontal ? node.scrollWidth - node.clientWidth : node.scrollHeight - node.clientHeight;
        if (max <= 0) return;
        const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
        const before = horizontal ? node.scrollLeft : node.scrollTop;
        const next = Math.min(max, Math.max(0, before + delta));
        if (next === before) return;
        event.preventDefault();
        if (horizontal) node.scrollLeft = next;
        else node.scrollTop = next;
        markOverflow(node, horizontal);
      };
      node.addEventListener('wheel', wheel, { passive: false });
      const observer =
        'ResizeObserver' in window
          ? new ResizeObserver(() => {
              markOverflow(node, horizontal);
            })
          : null;
      observer?.observe(node);
      markOverflow(node, horizontal);
      cleanup.current = () => {
        node.removeEventListener('wheel', wheel);
        observer?.disconnect();
      };
    },
    [horizontal, ref],
  );

  function end(event: PointerEvent<HTMLDivElement>) {
    if (pan.current?.pointerId !== event.pointerId) return;
    pan.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      ref={attach}
      className={cx(styles['strip'], styles[orientation], className)}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (event.button !== 1) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        pan.current = {
          pointerId: event.pointerId,
          start: horizontal ? event.clientX : event.clientY,
          offset: horizontal ? event.currentTarget.scrollLeft : event.currentTarget.scrollTop,
        };
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        const current = pan.current;
        if (current?.pointerId !== event.pointerId) return;
        const moved = (horizontal ? event.clientX : event.clientY) - current.start;
        if (horizontal) event.currentTarget.scrollLeft = current.offset - moved;
        else event.currentTarget.scrollTop = current.offset - moved;
        markOverflow(event.currentTarget, horizontal);
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        end(event);
      }}
      onPointerCancel={end}
      onScroll={(event) => {
        onScroll?.(event);
        markOverflow(event.currentTarget, horizontal);
      }}
      {...rest}
    />
  );
}
