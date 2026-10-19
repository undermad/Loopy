import type { ItemStyle } from '@shared/board';
import { resolveItemStyle } from '@renderer/lib/board';
import { useTranslation } from '@renderer/lib/i18n';
import { Switch } from '@renderer/ui';
import { NumberField } from '../../Properties/NumberField';
import type { TemplateDraft } from '../CardDesigner';
import { ColourRow } from './ColourRow';
import styles from '../CardDesigner.module.scss';

export function CardSettings({
  draft,
  onChange,
}: {
  draft: TemplateDraft;
  onChange: (next: Partial<TemplateDraft>) => void;
}) {
  const { t } = useTranslation('editors');
  const style = resolveItemStyle('card', draft.style);
  const setStyle = (next: ItemStyle) => {
    onChange({ style: { ...draft.style, ...next } });
  };
  const reset = t('properties.resetFill');

  return (
    <div className={styles['settingsBody']}>
      <h3 className={styles['heading']}>{t('cards.cardSettings')}</h3>
      <div className={styles['pair']}>
        <NumberField
          label={t('cards.width')}
          value={draft.width}
          min={120}
          step={10}
          digits={0}
          onCommit={(width) => {
            onChange({ width: Math.min(2000, Math.max(120, width)) });
          }}
        />
        <NumberField
          label={t('cards.height')}
          value={draft.height}
          min={80}
          step={10}
          digits={0}
          onCommit={(height) => {
            onChange({ height: Math.min(4000, Math.max(80, height)) });
          }}
        />
      </div>
      <div className={styles['pair']}>
        <NumberField
          label={t('cards.gap')}
          value={draft.gap}
          min={0}
          step={1}
          digits={0}
          onCommit={(gap) => {
            onChange({ gap: Math.min(64, Math.max(0, gap)) });
          }}
        />
        <NumberField
          label={t('properties.padding')}
          value={style.padding}
          min={0}
          step={1}
          digits={0}
          onCommit={(padding) => {
            setStyle({ padding: Math.min(200, Math.max(0, padding)) });
          }}
        />
      </div>
      <ColourRow
        label={t('cards.accent')}
        value={draft.accent}
        fallback="#6366f1"
        resetLabel={t('cards.noAccent')}
        onChange={(accent) => {
          onChange({ accent });
        }}
      />
      <ColourRow
        label={t('cards.fill')}
        value={draft.style.fill}
        fallback="#ffffff"
        resetLabel={reset}
        onChange={(fill) => {
          setStyle({ fill });
        }}
      />
      <ColourRow
        label={t('cards.border')}
        value={draft.style.stroke}
        fallback="#cbd5e1"
        resetLabel={reset}
        onChange={(stroke) => {
          setStyle({ stroke });
        }}
      />
      <ColourRow
        label={t('properties.textColour')}
        value={draft.style.textColour}
        fallback="#1a1a1a"
        resetLabel={reset}
        onChange={(textColour) => {
          setStyle({ textColour });
        }}
      />
      <div className={styles['pair']}>
        <NumberField
          label={t('properties.strokeWidth')}
          value={style.strokeWidth}
          min={0}
          step={1}
          digits={0}
          onCommit={(strokeWidth) => {
            setStyle({ strokeWidth: Math.min(32, Math.max(0, strokeWidth)) });
          }}
        />
        <NumberField
          label={t('cards.radius')}
          value={style.radius}
          min={0}
          step={1}
          digits={0}
          onCommit={(radius) => {
            setStyle({ radius: Math.min(400, Math.max(0, radius)) });
          }}
        />
      </div>
      <NumberField
        label={t('properties.fontSize')}
        value={style.fontSize}
        min={6}
        step={1}
        digits={0}
        onCommit={(fontSize) => {
          setStyle({ fontSize: Math.min(400, Math.max(6, fontSize)) });
        }}
      />
      <Switch
        size="sm"
        label={t('properties.shadow')}
        checked={style.shadow}
        onCheckedChange={(shadow) => {
          setStyle({ shadow });
        }}
      />
    </div>
  );
}
