import { useMemo, useState } from 'react';
import type { AreaNode } from '@shared/layout';
import { useTranslation } from '@renderer/lib/i18n';
import { setHoveredArea } from '@renderer/lib/workspaces';
import { cx } from '@renderer/ui';
import { AreaContext } from './AreaContext';
import { AreaCorner, CORNERS, type CornerPreview } from './AreaCorner';
import { AreaHeader } from './AreaHeader';
import { EditorView } from './EditorView';
import styles from './Area.module.scss';

export function Area({ area }: { area: AreaNode }) {
  const { t } = useTranslation('shell');
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [preview, setPreview] = useState<CornerPreview | null>(null);
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
        {preview ? (
          <div
            className={cx(styles['preview'], preview.kind !== 'split' && styles['previewRemove'])}
            aria-hidden="true"
          >
            <span className={styles['previewLabel']}>{previewLabel}</span>
          </div>
        ) : null}
      </section>
    </AreaContext>
  );
}
