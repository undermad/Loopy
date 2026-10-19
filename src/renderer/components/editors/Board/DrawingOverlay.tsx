import { useEffect, useRef, type PointerEvent } from 'react';
import { useStoreApi, useStore as useFlowStore } from '@xyflow/react';
import type { BoardNode } from '@shared/board';
import type { BrushTool } from '@shared/brushes';
import { captureBoard, commitChanges, nextZ } from '@renderer/lib/board';
import {
  beginPaint,
  colourAt,
  drawingAt,
  getBrushState,
  newLayer,
  pickLayer,
  setBrushColour,
  useBrushState,
  type PaintStroke,
  type Sample,
} from '@renderer/lib/drawing';
import { useResolvedColour } from '@renderer/lib/palettes';
import { useCanvasNavigation } from './navigation';
import styles from './DrawingOverlay.module.scss';

export interface DrawingOverlayProps {
  boardId: string;
  tool: BrushTool;
  nodes: BoardNode[];
  selectedIds: string[];
  rememberedLayer: string | null;
  wheel: 'zoom' | 'pan';
  minZoom: number;
  maxZoom: number;
  layerName: (count: number) => string;
  onLayer: (id: string) => void;
}

const PEN_ERASER = 32;
const SMALL_CURSOR = 4;

function sample(
  event: globalThis.PointerEvent,
  toFlow: (point: { x: number; y: number }) => { x: number; y: number },
): Sample {
  const point = toFlow({ x: event.clientX, y: event.clientY });
  return {
    x: point.x,
    y: point.y,
    pressure: event.pointerType === 'mouse' || !(event.pressure > 0) ? 1 : event.pressure,
    tiltX: event.tiltX || 0,
    tiltY: event.tiltY || 0,
  };
}

export function DrawingOverlay({
  boardId,
  tool,
  nodes,
  selectedIds,
  rememberedLayer,
  wheel,
  minZoom,
  maxZoom,
  layerName,
  onLayer,
}: DrawingOverlayProps) {
  const flowStore = useStoreApi();
  const surface = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const bounds = useRef<DOMRect | null>(null);
  const ring = useRef<{ x: number; y: number; frame: number | null }>({ x: 0, y: 0, frame: null });
  const stroke = useRef<{ pointerId: number; paint: PaintStroke } | null>(null);
  const navigation = useCanvasNavigation(surface, { wheel, minZoom, maxZoom });
  const brushes = useBrushState();
  const colour = useResolvedColour(brushes.colour) ?? brushes.colour.hex;
  const zoom = useFlowStore((store) => store.transform[2]);
  const diameter = brushes[tool].settings.size * zoom;
  const small = diameter < SMALL_CURSOR;
  const measure = () => (bounds.current = surface.current?.getBoundingClientRect() ?? null);
  const toFlow = (point: { x: number; y: number }) => {
    const box = bounds.current ?? measure();
    const [x, y, scale] = flowStore.getState().transform;
    return {
      x: (point.x - (box?.left ?? 0) - x) / scale,
      y: (point.y - (box?.top ?? 0) - y) / scale,
    };
  };

  useEffect(() => {
    const pending = ring.current;
    return () => {
      if (pending.frame !== null) cancelAnimationFrame(pending.frame);
    };
  }, []);

  function samples(event: PointerEvent<HTMLDivElement>): Sample[] {
    const native = event.nativeEvent;
    const coalesced = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [];
    return (coalesced.length > 0 ? coalesced : [native]).map((item) => sample(item, toFlow));
  }

  function place(event: PointerEvent<HTMLDivElement>) {
    const box = bounds.current ?? measure();
    const pending = ring.current;
    pending.x = event.clientX - (box?.left ?? 0);
    pending.y = event.clientY - (box?.top ?? 0);
    pending.frame ??= requestAnimationFrame(() => {
      pending.frame = null;
      if (cursor.current) {
        cursor.current.style.transform = `translate(${String(pending.x)}px, ${String(pending.y)}px)`;
      }
    });
  }

  function down(event: PointerEvent<HTMLDivElement>) {
    measure();
    if (navigation.startPan(event)) return;
    const penEraser = event.button === 5 || (event.buttons & PEN_ERASER) !== 0;
    if (event.button !== 0 && !penEraser) return;
    event.preventDefault();
    if (event.altKey) {
      const picked = colourAt(toFlow({ x: event.clientX, y: event.clientY }), nodes);
      if (picked) setBrushColour({ hex: picked, ref: null });
      return;
    }
    const mode: BrushTool = penEraser ? 'eraser' : tool;
    const state = getBrushState();
    const base = captureBoard(boardId);
    const point = toFlow({ x: event.clientX, y: event.clientY });
    let layer = pickLayer(nodes, selectedIds, rememberedLayer);
    if (!layer && mode === 'eraser') layer = pickLayer(nodes, [drawingAt(point, nodes)?.id ?? ''], null);
    if (!layer) {
      if (mode === 'eraser') return;
      const count = nodes.filter((node) => node.type === 'drawing').length + 1;
      layer = newLayer({
        boardId,
        name: layerName(count),
        z: nextZ(nodes),
        at: point,
      });
      void commitChanges(boardId, { upsertNodes: [layer] }, { history: false });
    }
    if (layer.id !== rememberedLayer) onLayer(layer.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    const paint = beginPaint({ boardId, node: layer, base, mode, settings: state[mode].settings, colour });
    stroke.current = { pointerId: event.pointerId, paint };
    paint.add(samples(event));
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    place(event);
    if (navigation.movePan(event)) return;
    const active = stroke.current;
    if (active?.pointerId === event.pointerId) active.paint.add(samples(event));
  }

  function up(event: PointerEvent<HTMLDivElement>) {
    if (navigation.endPan(event)) return;
    const active = stroke.current;
    if (active?.pointerId !== event.pointerId) return;
    stroke.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    void active.paint.end();
  }

  return (
    <div
      ref={surface}
      className={styles['overlay']}
      data-small={small || undefined}
      data-testid="drawing-overlay"
      onPointerEnter={measure}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onDragStart={(event) => {
        event.preventDefault();
      }}
      onWheel={navigation.onWheel}
    >
      <div
        ref={cursor}
        className={styles['cursor']}
        aria-hidden="true"
        style={{ width: diameter, height: diameter, margin: -diameter / 2 }}
      />
    </div>
  );
}
