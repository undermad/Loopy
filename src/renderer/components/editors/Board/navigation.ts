import { useRef, type PointerEvent, type RefObject, type WheelEvent } from 'react';
import { useReactFlow } from '@xyflow/react';

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

export function useCanvasNavigation(
  surface: RefObject<HTMLElement | null>,
  { wheel, minZoom, maxZoom }: CanvasNavigationOptions,
): CanvasNavigation {
  const flow = useReactFlow();
  const pan = useRef<{ pointerId: number; x: number; y: number } | null>(null);

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
      pan.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      return true;
    },
    movePan(event) {
      const panning = pan.current;
      if (panning?.pointerId !== event.pointerId) return false;
      const viewport = flow.getViewport();
      void flow.setViewport({
        ...viewport,
        x: viewport.x + event.clientX - panning.x,
        y: viewport.y + event.clientY - panning.y,
      });
      pan.current = { ...panning, x: event.clientX, y: event.clientY };
      return true;
    },
    endPan(event) {
      if (pan.current?.pointerId !== event.pointerId) return false;
      pan.current = null;
      return true;
    },
  };
}
