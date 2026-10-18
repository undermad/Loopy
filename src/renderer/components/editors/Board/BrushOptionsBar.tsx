import { SlidersHorizontal } from 'lucide-react';
import { BRUSH_PRESETS, type BrushTool } from '@shared/brushes';
import {
  brushModified,
  chooseBrushPreset,
  setBrushColour,
  updateBrush,
  useBrushState,
} from '@renderer/lib/drawing';
import { useTranslation } from '@renderer/lib/i18n';
import { Field, IconButton, NumberInput, Select } from '@renderer/ui';
import { ProjectColourPicker } from '../../ProjectColourPicker/ProjectColourPicker';
import styles from './BrushOptionsBar.module.scss';

export interface BrushOptionsBarProps {
  tool: BrushTool;
  onOpenSettings: () => void;
}

export function BrushOptionsBar({ tool, onOpenSettings }: BrushOptionsBarProps) {
  const { t } = useTranslation('editors');
  const brushes = useBrushState();
  const state = brushes[tool];
  const { settings } = state;
  const modified = brushModified(state);
  const presetLabel = (id: string) => t(`drawing.presets.${id}` as 'drawing.presets.pen');

  return (
    <div className={styles['bar']} role="toolbar" aria-label={t('drawing.options')}>
      <Select
        size="sm"
        className={styles['preset']}
        aria-label={t('drawing.preset')}
        value={state.preset}
        options={BRUSH_PRESETS.filter((preset) => preset.tool === tool).map((preset) => ({
          value: preset.id,
          label:
            preset.id === state.preset && modified
              ? `${presetLabel(preset.id)} (${t('drawing.modified')})`
              : presetLabel(preset.id),
        }))}
        onValueChange={(id) => {
          chooseBrushPreset(tool, id);
        }}
      />
      <Field label={t('drawing.size')} className={styles['field']}>
        <NumberInput
          size="sm"
          value={settings.size}
          min={0.5}
          max={1000}
          step={1}
          digits={1}
          onValueChange={(size) => {
            if (size !== null) updateBrush(tool, { size });
          }}
        />
      </Field>
      <Field label={t('drawing.opacity')} className={styles['field']}>
        <NumberInput
          size="sm"
          value={Math.round(settings.opacity * 100)}
          min={0}
          max={100}
          step={1}
          digits={0}
          onValueChange={(value) => {
            if (value !== null) updateBrush(tool, { opacity: value / 100 });
          }}
        />
      </Field>
      <Field label={t('drawing.flow')} className={styles['field']}>
        <NumberInput
          size="sm"
          value={Math.round(settings.flow * 100)}
          min={1}
          max={100}
          step={1}
          digits={0}
          onValueChange={(value) => {
            if (value !== null) updateBrush(tool, { flow: value / 100 });
          }}
        />
      </Field>
      {tool === 'brush' ? (
        <ProjectColourPicker
          size="sm"
          label={t('drawing.colour')}
          value={brushes.colour}
          onChange={setBrushColour}
        />
      ) : null}
      <IconButton size="sm" label={t('drawing.settings')} onClick={onOpenSettings}>
        <SlidersHorizontal aria-hidden="true" />
      </IconButton>
    </div>
  );
}
