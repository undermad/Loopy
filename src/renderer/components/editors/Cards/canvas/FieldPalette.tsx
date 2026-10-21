import { createElement } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { FIELD_PRESETS, type FieldPresetId } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { cx } from '@renderer/ui';
import { FIELD_ICONS } from '../fieldIcons';
import styles from './Canvas.module.scss';

export const PRESET_DRAG = 'preset:';

function PaletteItem({ preset, onAdd }: { preset: FieldPresetId; onAdd: (preset: FieldPresetId) => void }) {
  const { t } = useTranslation('editors');
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `${PRESET_DRAG}${preset}` });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-roledescription={undefined}
      className={cx(styles['paletteItem'], isDragging && styles['paletteDragging'])}
      title={t('cards.paletteHint')}
      onClick={() => {
        onAdd(preset);
      }}
    >
      {createElement(FIELD_ICONS[preset], { 'aria-hidden': true })}
      <span>{t(`cards.presets.${preset}`)}</span>
    </button>
  );
}

export function FieldPalette({ onAdd }: { onAdd: (preset: FieldPresetId) => void }) {
  const { t } = useTranslation('editors');
  return (
    <div role="toolbar" aria-label={t('cards.palette')} className={styles['palette']}>
      {FIELD_PRESETS.map((preset) => (
        <PaletteItem key={preset.id} preset={preset.id} onAdd={onAdd} />
      ))}
    </div>
  );
}

export function PaletteChip({ preset }: { preset: FieldPresetId }) {
  const { t } = useTranslation('editors');
  return (
    <span className={cx(styles['paletteItem'], styles['paletteChip'])}>
      {createElement(FIELD_ICONS[preset], { 'aria-hidden': true })}
      <span>{t(`cards.presets.${preset}`)}</span>
    </span>
  );
}
