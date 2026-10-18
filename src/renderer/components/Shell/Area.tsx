import { useMemo, useState } from 'react';
import type { AreaNode } from '@shared/layout';
import { useTranslation } from '@renderer/lib/i18n';
import { setHoveredArea, useAreaDrag } from '@renderer/lib/workspaces';
import { cx } from '@renderer/ui';
import { AreaContext } from './AreaContext';
import { AreaCorner, CORNERS, type CornerPreview } from './AreaCorner';
import { AreaHeader } from './AreaHeader';
import { EditorView } from './EditorView';
import styles from './Area.module.scss';

function splitAt(ratio: number): number {
  return Math.round(Math.min(0.9, Math.max(0.1, ratio)) * 1000) / 10;
}

export function Area({ area }: { area: AreaNode }) {
  const { t } = useTranslation('shell');
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [preview, setPreview] = useState<CornerPreview | null>(null);
  const drag = useAreaDrag();
  const dock =
    drag?.targetId === area.id && drag.zone
      ? drag.zone
      : drag?.sourceId === area.id && drag.zone === 'outside'
        ? 'outside'
        : null;
  const context = useMemo(() => ({ areaId: area.id, headerSlot }), [area.id, headerSlot]);

  let previewLabel: string | null = null;
  if (preview?.kind === 'split') {
    previewLabel = t(preview.direction === 'row' ? 'area.preview.splitRow' : 'area.preview.splitColumn');
  } else if (preview) {
    previewLabel = t(preview.kind === 'swap' ? 'area.preview.swap' : 'area.preview.join');
  }

  return (
    <AreaContext value={context}>
      <section
        className={styles['area']}
        data-area-id={area.id}
        aria-label={area.editor}
        onPointerEnter={() => {
          setHoveredArea(area.id);
        }}
        onPointerLeave={() => {
          setHoveredArea(null);
        }}
      >
        <AreaHeader area={area} slotRef={setHeaderSlot} />
        <div className={styles['body']}>
          <EditorView area={area} />
        </div>
        {CORNERS.map((corner) => (
          <AreaCorner key={corner} corner={corner} areaId={area.id} onPreview={setPreview} />
        ))}
        {dock ? (
          <div className={styles['dockPreview']} data-zone={dock} aria-hidden="true">
            <div className={styles['dockZone']}>
              <span className={styles['previewLabel']}>{t(`area.dock.${dock}`)}</span>
            </div>
          </div>
        ) : null}
        {preview?.kind === 'split' ? (
          <div className={styles['splitPreview']} data-direction={preview.direction} aria-hidden="true">
            <div
              className={styles['splitNew']}
              style={
                preview.direction === 'row'
                  ? { left: `${String(splitAt(preview.ratio))}%` }
                  : { top: `${String(splitAt(preview.ratio))}%` }
              }
            />
            <div
              className={styles['splitLine']}
              style={
                preview.direction === 'row'
                  ? { left: `${String(splitAt(preview.ratio))}%` }
                  : { top: `${String(splitAt(preview.ratio))}%` }
              }
            >
              <span className={styles['previewLabel']}>{previewLabel}</span>
            </div>
          </div>
        ) : preview ? (
          <div className={cx(styles['preview'], styles['previewRemove'])} aria-hidden="true">
            <span className={styles['previewLabel']}>{previewLabel}</span>
          </div>
        ) : null}
      </section>
    </AreaContext>
  );
}
