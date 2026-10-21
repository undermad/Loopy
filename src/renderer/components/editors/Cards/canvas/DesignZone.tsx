import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { CARD_COLUMNS } from '@shared/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { cx } from '@renderer/ui';
import type { CardDesignZoneProps } from '../CardView';
import { useCanvas } from './context';
import styles from './Canvas.module.scss';

const COLUMNS = Array.from({ length: CARD_COLUMNS }, (_, index) => index);

export function DesignZone({ zone, ids, className, style, children }: CardDesignZoneProps) {
  const { t } = useTranslation('editors');
  const canvas = useCanvas();
  const { setNodeRef, isOver } = useDroppable({ id: `zone:${zone}` });
  const resizingHere = canvas.resizing !== null && ids.includes(canvas.resizing.id);
  return (
    <SortableContext id={zone} items={ids} strategy={rectSortingStrategy}>
      <div
        ref={setNodeRef}
        role="region"
        aria-label={t('cards.zoneName', { zone: t(`cards.zones.${zone}`) })}
        className={cx(className, styles['zone'], isOver && styles['zoneOver'])}
        style={style}
        data-zone={zone}
      >
        {canvas.showGrid ? (
          <div className={styles['grid']} style={{ gap: style.gap }} data-grid-overlay="" aria-hidden="true">
            {COLUMNS.map((column) => (
              <span key={column} />
            ))}
          </div>
        ) : null}
        {resizingHere ? (
          <div
            className={cx(styles['grid'], styles['guides'])}
            style={{ gap: style.gap }}
            data-column-guides=""
            aria-hidden="true"
          >
            {COLUMNS.map((column) => (
              <span key={column} />
            ))}
          </div>
        ) : null}
        {children}
        {ids.length === 0 ? <span className={styles['dropHint']}>{t('cards.dropHere')}</span> : null}
      </div>
    </SortableContext>
  );
}
