import { useRef, useState, type PointerEvent } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { BoardNode } from '@shared/board';
import { itemAt, normaliseRect, type Point, type Rect } from '@renderer/lib/board';
import { useCanvasNavigation } from './navigation';
import styles from './CreationOverlay.module.scss';

export type Placement = { point: Point } | { rect: Rect };

export interface CreationOverlayProps {
  mode: 'place' | 'connect';
  wheel: 'zoom' | 'pan';
  minZoom: number;
  maxZoom: number;
  nodes: BoardNode[];
  onPlace: (placement: Placement) => void;
  onConnect: (sourceId: string, targetId: string) => void;
  onConnectEmpty: (sourceId: string, clientX: number, clientY: number) => void;
}

interface Drag {
  from: Point;
  to: Point;
  start: Point;
  sourceId: string | null;
}

const CLICK_TOLERANCE = 6;

export function CreationOverlay({
  mode,
  wheel,
  minZoom,
  maxZoom,
  nodes,
  onPlace,
  onConnect,
  onConnectEmpty,
}: CreationOverlayProps) {
  const flow = useReactFlow();
  const surface = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const navigation = useCanvasNavigation(surface, { wheel, minZoom, maxZoom });

  const local = (event: PointerEvent): Point => {
    const bounds = surface.current?.getBoundingClientRect();
    return { x: event.clientX - (bounds?.left ?? 0), y: event.clientY - (bounds?.top ?? 0) };
  };
  const toFlow = (event: PointerEvent): Point =>
    flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });

  function down(event: PointerEvent<HTMLDivElement>) {
    if (navigation.startPan(event) || event.button !== 0) return;
    const start = toFlow(event);
    const sourceId = mode === 'connect' ? (itemAt(start, nodes)?.id ?? null) : null;
    if (mode === 'connect' && !sourceId) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = local(event);
    setDrag({ from: point, to: point, start, sourceId });
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (navigation.movePan(event)) return;
    if (drag) setDrag({ ...drag, to: local(event) });
  }

  function up(event: PointerEvent<HTMLDivElement>) {
    if (navigation.endPan(event) || !drag) return;
    setDrag(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const end = toFlow(event);
    if (mode === 'connect') {
      const target = drag.sourceId ? itemAt(end, nodes, [drag.sourceId]) : null;
      if (drag.sourceId && target) onConnect(drag.sourceId, target.id);
      else if (
        drag.sourceId &&
        Math.hypot(drag.to.x - drag.from.x, drag.to.y - drag.from.y) >= CLICK_TOLERANCE
      ) {
        onConnectEmpty(drag.sourceId, event.clientX, event.clientY);
      }
      return;
    }
    const distance = Math.hypot(drag.to.x - drag.from.x, drag.to.y - drag.from.y);
    if (distance < CLICK_TOLERANCE) onPlace({ point: drag.start });
    else onPlace({ rect: normaliseRect(drag.start, end) });
  }

  const ghost = drag ? normaliseRect(drag.from, drag.to) : null;

  return (
    <div
      ref={surface}
      className={styles['overlay']}
      data-mode={mode}
      data-testid="creation-overlay"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onWheel={navigation.onWheel}
      onPointerCancel={(event) => {
        navigation.endPan(event);
        setDrag(null);
      }}
    >
      {drag && ghost && mode === 'place' ? (
        <div
          className={styles['ghost']}
          style={{ left: ghost.x, top: ghost.y, width: ghost.width, height: ghost.height }}
        />
      ) : null}
      {drag && mode === 'connect' ? (
        <svg className={styles['line']} aria-hidden="true">
          <line x1={drag.from.x} y1={drag.from.y} x2={drag.to.x} y2={drag.to.y} />
        </svg>
      ) : null}
    </div>
  );
}
