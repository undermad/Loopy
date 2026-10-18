import { useRef, type PointerEvent } from 'react';
import { GripVertical } from 'lucide-react';
import { useTranslation } from '@renderer/lib/i18n';
import { areaActions, detachArea, dockZoneAt, setAreaDrag } from '@renderer/lib/workspaces';
import styles from './AreaHeader.module.scss';

const THRESHOLD = 4;

interface Drag {
  pointerId: number;
  x: number;
  y: number;
  moved: boolean;
}

export function AreaMoveHandle({ areaId }: { areaId: string }) {
  const { t } = useTranslation('shell');
  const drag = useRef<Drag | null>(null);

  function finish(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    drag.current = null;
    setAreaDrag(null);
    if (current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!current.moved || event.type !== 'pointerup') return;
    const target = dockZoneAt(event.clientX, event.clientY, areaId);
    if (target.zone === 'outside') {
      const rect = event.currentTarget.closest('[data-area-id]')?.getBoundingClientRect();
      void detachArea(areaId, {
        x: event.screenX - 40,
        y: event.screenY - 16,
        width: rect?.width ?? 640,
        height: rect?.height ?? 480,
      });
    } else if (target.targetId && target.zone) {
      areaActions.move(areaId, target.targetId, target.zone);
    }
  }

  return (
    <button
      type="button"
      className={styles['grip']}
      aria-label={t('area.move')}
      title={t('area.move')}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (current?.pointerId !== event.pointerId) return;
        if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < THRESHOLD)
          return;
        current.moved = true;
        setAreaDrag({ sourceId: areaId, ...dockZoneAt(event.clientX, event.clientY, areaId) });
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
    >
      <GripVertical aria-hidden="true" />
    </button>
  );
}
