import { useRef, type PointerEvent } from 'react';
import type { SplitDirection } from '@shared/layout';
import { useTranslation } from '@renderer/lib/i18n';
import { neighbours, type Side } from '@renderer/lib/layout';
import { areaActions, useActiveWorkspace } from '@renderer/lib/workspaces';
import { cx } from '@renderer/ui';
import styles from './AreaCorner.module.scss';

export type Corner = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
export const CORNERS: Corner[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

export type CornerPreview =
  | { kind: 'split'; direction: SplitDirection; ratio: number }
  | { kind: 'join'; targetId: string; side: Side }
  | { kind: 'swap'; targetId: string; side: Side };

export interface AreaCornerProps {
  corner: Corner;
  areaId: string;
  onPreview: (preview: CornerPreview | null) => void;
}

const THRESHOLD = 4;

interface Drag {
  startX: number;
  startY: number;
  rect: DOMRect;
  preview: CornerPreview | null;
}

export function AreaCorner({ corner, areaId, onPreview }: AreaCornerProps) {
  const { t } = useTranslation('shell');
  const workspace = useActiveWorkspace();
  const drag = useRef<Drag | null>(null);

  function resolve(event: PointerEvent<HTMLButtonElement>, current: Drag): CornerPreview | null {
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (Math.hypot(dx, dy) < THRESHOLD) return null;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const inwardX = corner.endsWith('Left') ? dx > 0 : dx < 0;
    const inwardY = corner.startsWith('top') ? dy > 0 : dy < 0;
    const inward = horizontal ? inwardX : inwardY;
    if (inward) {
      const ratio = horizontal
        ? (event.clientX - current.rect.left) / current.rect.width
        : (event.clientY - current.rect.top) / current.rect.height;
      return { kind: 'split', direction: horizontal ? 'row' : 'column', ratio };
    }
    const side: Side = horizontal ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'top' : 'bottom';
    const target = workspace ? neighbours(workspace.root, areaId)[side] : undefined;
    if (!target) return null;
    return { kind: event.ctrlKey || event.metaKey ? 'swap' : 'join', targetId: target.id, side };
  }

  return (
    <button
      type="button"
      className={cx(styles['corner'], styles[corner])}
      aria-label={t('area.corner')}
      tabIndex={-1}
      onPointerDown={(event) => {
        const area = event.currentTarget.parentElement;
        if (!area || event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
          startX: event.clientX,
          startY: event.clientY,
          rect: area.getBoundingClientRect(),
          preview: null,
        };
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current) return;
        current.preview = resolve(event, current);
        onPreview(current.preview);
      }}
      onPointerUp={(event) => {
        const current = drag.current;
        drag.current = null;
        onPreview(null);
        if (!current) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        const preview = resolve(event, current);
        if (!preview) return;
        if (preview.kind === 'split') areaActions.split(areaId, preview.direction, preview.ratio);
        else if (preview.kind === 'join') areaActions.join(areaId, preview.targetId);
        else areaActions.swap(areaId, preview.targetId);
      }}
      onPointerCancel={() => {
        drag.current = null;
        onPreview(null);
      }}
    />
  );
}
