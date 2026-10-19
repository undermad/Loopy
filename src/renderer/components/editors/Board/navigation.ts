import { useRef, type PointerEvent, type RefObject, type WheelEvent } from 'react';
import { useReactFlow, type Viewport } from '@xyflow/react';

export interface CanvasNavigationOptions {
  wheel: 'zoom' | 'pan';
  minZoom: number;
  maxZoom: number;
}

export interface CanvasNavigation {
  onWheel: (event: WheelEvent<HTMLElement>) => void;
  startPan: (event: PointerEvent<HTMLElement>) => boolean;
  movePan: (event: PointerEvent<HTMLElement>) => boolean;
  endPan: (event: PointerEvent<HTMLElement>) => boolean;
}

interface Pan {
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  viewport: Viewport;
  frame: number | null;
}

export function useCanvasNavigation(
  surface: RefObject<HTMLElement | null>,
  { wheel, minZoom, maxZoom }: CanvasNavigationOptions,
): CanvasNavigation {
  const flow = useReactFlow();
  const pan = useRef<Pan | null>(null);

  function apply(panning: Pan) {
    panning.frame = null;
    void flow.setViewport({
      ...panning.viewport,
      x: panning.viewport.x + panning.x - panning.startX,
      y: panning.viewport.y + panning.y - panning.startY,
    });
  }

  return {
    onWheel(event) {
      const viewport = flow.getViewport();
      if (wheel === 'pan' && !event.ctrlKey) {
        void flow.setViewport({ ...viewport, x: viewport.x - event.deltaX, y: viewport.y - event.deltaY });
        return;
      }
      const bounds = surface.current?.getBoundingClientRect();
      const point = { x: event.clientX - (bounds?.left ?? 0), y: event.clientY - (bounds?.top ?? 0) };
      const scale = event.deltaMode === 1 ? 0.05 : event.deltaMode === 2 ? 1 : 0.002;
      const zoom = Math.min(maxZoom, Math.max(minZoom, viewport.zoom * 2 ** (-event.deltaY * scale)));
      const ratio = zoom / viewport.zoom;
      void flow.setViewport({
        zoom,
        x: point.x - (point.x - viewport.x) * ratio,
        y: point.y - (point.y - viewport.y) * ratio,
      });
    },
    startPan(event) {
      if (event.button !== 1) return false;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      pan.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        viewport: flow.getViewport(),
        frame: null,
      };
      surface.current?.setAttribute('data-panning', '');
      return true;
    },
    movePan(event) {
      const panning = pan.current;
      if (panning?.pointerId !== event.pointerId) return false;
      panning.x = event.clientX;
      panning.y = event.clientY;
      panning.frame ??= requestAnimationFrame(() => {
        apply(panning);
      });
      return true;
    },
    endPan(event) {
      const panning = pan.current;
      if (panning?.pointerId !== event.pointerId) return false;
      pan.current = null;
      if (panning.frame !== null) cancelAnimationFrame(panning.frame);
      panning.x = event.clientX;
      panning.y = event.clientY;
      apply(panning);
      surface.current?.removeAttribute('data-panning');
      return true;
    },
  };
}
