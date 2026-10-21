import { Eraser, Redo2, Sparkles, Undo2 } from 'lucide-react';
import { useTranslation } from '@renderer/lib/i18n';
import { Button, IconButton, Select, Switch, ToggleGroup } from '@renderer/ui';
import styles from '../CardDesigner.module.scss';

export type DesignerMode = 'design' | 'fill';

export const ZOOMS = [0.5, 0.75, 1, 1.5, 2] as const;

const NO_SOURCE = '__none';

export interface StageBarProps {
  mode: DesignerMode;
  canDesign: boolean;
  canUndo: boolean;
  canRedo: boolean;
  showGrid: boolean;
  zoom: number;
  sources: { id: string; name: string }[];
  source: string | null;
  onMode: (mode: DesignerMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  onGrid: (show: boolean) => void;
  onZoom: (zoom: number) => void;
  onSample: () => void;
  onClear: () => void;
  onSource: (id: string | null) => void;
}

export function StageBar({
  mode,
  canDesign,
  canUndo,
  canRedo,
  showGrid,
  zoom,
  sources,
  source,
  onMode,
  onUndo,
  onRedo,
  onGrid,
  onZoom,
  onSample,
  onClear,
  onSource,
}: StageBarProps) {
  const { t } = useTranslation('editors');
  return (
    <div className={styles['stageBar']}>
      {canDesign ? (
        <ToggleGroup
          size="sm"
          aria-label={t('cards.previewMode')}
          value={mode}
          items={[
            { value: 'design', label: t('cards.modes.design') },
            { value: 'fill', label: t('cards.modes.fill') },
          ]}
          onValueChange={(next) => {
            onMode(next as DesignerMode);
          }}
        />
      ) : null}
      <IconButton label={t('cards.undo')} size="sm" disabled={!canUndo} onClick={onUndo}>
        <Undo2 aria-hidden="true" />
      </IconButton>
      <IconButton label={t('cards.redo')} size="sm" disabled={!canRedo} onClick={onRedo}>
        <Redo2 aria-hidden="true" />
      </IconButton>
      {mode === 'design' && canDesign ? (
        <Switch size="sm" label={t('cards.showGrid')} checked={showGrid} onCheckedChange={onGrid} />
      ) : (
        <>
          <Button size="sm" variant="ghost" icon={<Sparkles aria-hidden="true" />} onClick={onSample}>
            {t('cards.sample')}
          </Button>
          <Button size="sm" variant="ghost" icon={<Eraser aria-hidden="true" />} onClick={onClear}>
            {t('cards.clearValues')}
          </Button>
          {sources.length > 0 ? (
            <Select
              size="sm"
              aria-label={t('cards.previewFrom')}
              value={source ?? NO_SOURCE}
              options={[
                { value: NO_SOURCE, label: t('cards.previewOwn') },
                ...sources.map((item) => ({ value: item.id, label: item.name })),
              ]}
              onValueChange={(value) => {
                onSource(value === NO_SOURCE ? null : value);
              }}
            />
          ) : null}
        </>
      )}
      <span className={styles['spacer']} />
      <Select
        size="sm"
        aria-label={t('cards.zoom')}
        value={String(zoom)}
        options={ZOOMS.map((value) => ({ value: String(value), label: `${String(value * 100)}%` }))}
        onValueChange={(value) => {
          onZoom(Number(value));
        }}
      />
    </div>
  );
}
