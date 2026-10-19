import { useCallback, useEffect, useRef } from 'react';
import type { Viewport } from '@xyflow/react';

const SAVE_DELAY = 150;

export function useViewportSave(
  initial: Viewport,
  save: (viewport: Viewport) => void,
): (event: unknown, viewport: Viewport) => void {
  const saved = useRef(initial);
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; viewport: Viewport } | null>(null);
  const latestSave = useRef(save);

  useEffect(() => {
    latestSave.current = save;
  }, [save]);

  const flush = useCallback(() => {
    const next = pending.current;
    if (!next) return;
    clearTimeout(next.timer);
    pending.current = null;
    saved.current = next.viewport;
    latestSave.current(next.viewport);
  }, []);

  useEffect(() => flush, [flush]);

  return useCallback(
    (_event: unknown, viewport: Viewport) => {
      if (pending.current) clearTimeout(pending.current.timer);
      const { x, y, zoom } = saved.current;
      if (viewport.x === x && viewport.y === y && viewport.zoom === zoom) {
        pending.current = null;
        return;
      }
      pending.current = { timer: setTimeout(flush, SAVE_DELAY), viewport };
    },
    [flush],
  );
}
