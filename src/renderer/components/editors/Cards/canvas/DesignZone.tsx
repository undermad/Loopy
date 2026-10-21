import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { CARD_COLUMNS } from '@shared/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { cx } from '@renderer/ui';
import type { CardDesignZoneProps } from '../CardView';
import { FieldPicker } from '../FieldPicker';
import { useCanvas } from './context';
import styles from './Canvas.module.scss';

const COLUMNS = Array.from({ length: CARD_COLUMNS }, (_, index) => index);
const GRID_ROW = 16;
const CELLS = { '--grid-row': `${String(GRID_ROW)}px` };

export function DesignZone({ zone, ids, className, style, children }: CardDesignZoneProps) {
  const { t } = useTranslation('editors');
  const canvas = useCanvas();
  const { setNodeRef, isOver } = useDroppable({ id: `zone:${zone}` });
  const resizingHere = canvas.resizing !== null && ids.includes(canvas.resizing.id);
  const label = t('cards.addFieldTo', { zone: t(`cards.zones.${zone}`) });
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
          <div
            className={cx(styles['grid'], styles['cells'])}
            style={{ gap: style.gap, ...CELLS }}
            data-grid-overlay=""
            data-grid-rows={String(GRID_ROW)}
            aria-hidden="true"
          >
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
        <span
          className={styles['zoneAdd']}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <FieldPicker
            label={label}
            onPick={(preset) => {
              canvas.addToZone(zone, preset);
            }}
            trigger={
              <button type="button" className={styles['add']} aria-label={label}>
                <Plus aria-hidden="true" />
              </button>
            }
          />
        </span>
      </div>
    </SortableContext>
  );
}
