import { FONT_FAMILIES, type FontFamily, type ItemStyle } from '@shared/board';
import { ACCENT_PLACEMENTS, BACKGROUND_FITS, type AccentPlacement, type CardLayout } from '@shared/cards';
import { useAssetsSnapshot } from '@renderer/lib/assets';
import { resolveItemStyle } from '@renderer/lib/board';
import { CARD_SIZES } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { Field, PropertySection, Select, Switch } from '@renderer/ui';
import { NumberField } from '../../Properties/NumberField';
import type { TemplateDraft } from '../CardDesigner';
import { ColourRow } from './ColourRow';
import styles from '../CardDesigner.module.scss';

const CUSTOM = 'custom';
const NONE = '__none';

type Patch = (next: Partial<TemplateDraft>) => void;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function SizeSection({ draft, onChange }: { draft: TemplateDraft; onChange: Patch }) {
  const { t } = useTranslation('editors');
  const style = resolveItemStyle('card', draft.style);
  const preset = CARD_SIZES.find((size) => size.width === draft.width && size.height === draft.height);
  return (
    <PropertySection title={t('cards.sections.size')}>
      <Field label={t('cards.size')}>
        <Select
          size="sm"
          value={preset?.id ?? CUSTOM}
          aria-label={t('cards.size')}
          options={[
            { value: CUSTOM, label: t('cards.cardSizes.custom') },
            ...CARD_SIZES.map((size) => ({ value: size.id, label: t(`cards.cardSizes.${size.id}`) })),
          ]}
          onValueChange={(id) => {
            const size = CARD_SIZES.find((item) => item.id === id);
            if (size) onChange({ width: size.width, height: size.height });
          }}
        />
      </Field>
      <div className={styles['pair']}>
        <NumberField
          label={t('cards.width')}
          value={draft.width}
          min={120}
          step={10}
          digits={0}
          onCommit={(width) => {
            onChange({ width: clamp(width, 120, 2000) });
          }}
        />
        <NumberField
          label={t('cards.height')}
          value={draft.height}
          min={80}
          step={10}
          digits={0}
          onCommit={(height) => {
            onChange({ height: clamp(height, 80, 4000) });
          }}
        />
      </div>
      <Switch
        size="sm"
        label={t('cards.autoHeight')}
        checked={draft.autoHeight}
        onCheckedChange={(autoHeight) => {
          onChange({ autoHeight });
        }}
      />
      <div className={styles['pair']}>
        <NumberField
          label={t('cards.gap')}
          value={draft.gap}
          min={0}
          step={1}
          digits={0}
          onCommit={(gap) => {
            onChange({ gap: clamp(gap, 0, 64) });
          }}
        />
        <NumberField
          label={t('properties.padding')}
          value={style.padding}
          min={0}
          step={1}
          digits={0}
          onCommit={(padding) => {
            onChange({ style: { ...draft.style, padding: clamp(padding, 0, 200) } });
          }}
        />
      </div>
    </PropertySection>
  );
}

function BackgroundSection({ draft, onChange }: { draft: TemplateDraft; onChange: Patch }) {
  const { t } = useTranslation('editors');
  const images = useAssetsSnapshot().assets.filter((asset) => asset.kind === 'image');
  const background = draft.background;
  const setBackground = (next: Partial<CardLayout['background']>) => {
    onChange({ background: { ...background, ...next } });
  };
  return (
    <PropertySection title={t('cards.sections.background')}>
      <ColourRow
        label={t('cards.fill')}
        value={draft.style.fill}
        fallback="#ffffff"
        resetLabel={t('properties.resetFill')}
        onChange={(fill) => {
          onChange({ style: { ...draft.style, fill } });
        }}
      />
      <Switch
        size="sm"
        label={t('cards.gradient')}
        checked={background.gradient !== null}
        onCheckedChange={(on) => {
          setBackground({ gradient: on ? { colour: { hex: '#000000', ref: null }, angle: 180 } : null });
        }}
      />
      {background.gradient ? (
        <div className={styles['pair']}>
          <ColourRow
            label={t('cards.gradientColour')}
            value={background.gradient.colour}
            fallback="#000000"
            resetLabel={t('properties.resetFill')}
            onChange={(colour) => {
              if (colour && background.gradient)
                setBackground({ gradient: { ...background.gradient, colour } });
            }}
          />
          <NumberField
            label={t('cards.angle')}
            value={background.gradient.angle}
            min={0}
            step={15}
            digits={0}
            onCommit={(angle) => {
              if (background.gradient) {
                setBackground({ gradient: { ...background.gradient, angle: clamp(angle, 0, 360) } });
              }
            }}
          />
        </div>
      ) : null}
      <Field label={t('cards.image')}>
        <Select
          size="sm"
          value={background.image ?? NONE}
          aria-label={t('cards.image')}
          options={[
            { value: NONE, label: t('cards.noBackgroundImage') },
            ...images.map((asset) => ({ value: asset.id, label: asset.name })),
          ]}
          onValueChange={(image) => {
            setBackground({ image: image === NONE ? null : image });
          }}
        />
      </Field>
      {background.image ? (
        <div className={styles['pair']}>
          <Field label={t('cards.imageFit')}>
            <Select
              size="sm"
              value={background.fit}
              aria-label={t('cards.imageFit')}
              options={BACKGROUND_FITS.map((fit) => ({ value: fit, label: t(`cards.fits.${fit}`) }))}
              onValueChange={(fit) => {
                setBackground({ fit: fit as CardLayout['background']['fit'] });
              }}
            />
          </Field>
          <NumberField
            label={t('cards.overlay')}
            value={Math.round(background.overlay * 100)}
            min={0}
            step={5}
            digits={0}
            onCommit={(percent) => {
              setBackground({ overlay: clamp(percent, 0, 100) / 100 });
            }}
          />
        </div>
      ) : null}
    </PropertySection>
  );
}

function AccentSection({ draft, onChange }: { draft: TemplateDraft; onChange: Patch }) {
  const { t } = useTranslation('editors');
  const choices = draft.fields.filter((field) => field.kind === 'choice');
  return (
    <PropertySection title={t('cards.sections.accent')}>
      <ColourRow
        label={t('cards.accent')}
        value={draft.accent}
        fallback="#6366f1"
        resetLabel={t('cards.noAccent')}
        onChange={(accent) => {
          onChange({ accent });
        }}
      />
      <Field label={t('cards.accentPlacement')}>
        <Select
          size="sm"
          value={draft.accentPlacement}
          aria-label={t('cards.accentPlacement')}
          options={ACCENT_PLACEMENTS.map((placement) => ({
            value: placement,
            label: t(`cards.placements.${placement}`),
          }))}
          onValueChange={(placement) => {
            onChange({ accentPlacement: placement as AccentPlacement });
          }}
        />
      </Field>
      <Field label={t('cards.accentFrom')} hint={t('cards.accentFromHint')}>
        <Select
          size="sm"
          value={draft.accentField ?? NONE}
          aria-label={t('cards.accentFrom')}
          options={[
            { value: NONE, label: t('cards.accentFromNone') },
            ...choices.map((field) => ({ value: field.id, label: field.label || field.id })),
          ]}
          onValueChange={(id) => {
            onChange({ accentField: id === NONE ? null : id });
          }}
        />
      </Field>
    </PropertySection>
  );
}

function BorderSection({ draft, onChange }: { draft: TemplateDraft; onChange: Patch }) {
  const { t } = useTranslation('editors');
  const style = resolveItemStyle('card', draft.style);
  const setStyle = (next: ItemStyle) => {
    onChange({ style: { ...draft.style, ...next } });
  };
  return (
    <PropertySection title={t('cards.sections.border')}>
      <ColourRow
        label={t('cards.border')}
        value={draft.style.stroke}
        fallback="#cbd5e1"
        resetLabel={t('properties.resetFill')}
        onChange={(stroke) => {
          setStyle({ stroke });
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
            setStyle({ strokeWidth: clamp(strokeWidth, 0, 32) });
          }}
        />
        <NumberField
          label={t('cards.radius')}
          value={style.radius}
          min={0}
          step={1}
          digits={0}
          onCommit={(radius) => {
            setStyle({ radius: clamp(radius, 0, 400) });
          }}
        />
      </div>
      <Switch
        size="sm"
        label={t('properties.shadow')}
        checked={style.shadow}
        onCheckedChange={(shadow) => {
          setStyle({ shadow });
        }}
      />
    </PropertySection>
  );
}

function TextSection({ draft, onChange }: { draft: TemplateDraft; onChange: Patch }) {
  const { t } = useTranslation('editors');
  const style = resolveItemStyle('card', draft.style);
  return (
    <PropertySection title={t('cards.sections.text')}>
      <ColourRow
        label={t('properties.textColour')}
        value={draft.style.textColour}
        fallback="#1a1a1a"
        resetLabel={t('properties.resetFill')}
        onChange={(textColour) => {
          onChange({ style: { ...draft.style, textColour } });
        }}
      />
      <div className={styles['pair']}>
        <NumberField
          label={t('properties.fontSize')}
          value={style.fontSize}
          min={6}
          step={1}
          digits={0}
          onCommit={(fontSize) => {
            onChange({ style: { ...draft.style, fontSize: clamp(fontSize, 6, 400) } });
          }}
        />
        <Field label={t('properties.font')}>
          <Select
            size="sm"
            value={draft.font}
            aria-label={t('properties.font')}
            options={FONT_FAMILIES.map((font) => ({ value: font, label: t(`properties.fonts.${font}`) }))}
            onValueChange={(font) => {
              onChange({ font: font as FontFamily });
            }}
          />
        </Field>
      </div>
    </PropertySection>
  );
}

export function CardSettings({ draft, onChange }: { draft: TemplateDraft; onChange: Patch }) {
  const { t } = useTranslation('editors');
  return (
    <div className={styles['settingsBody']}>
      <h3 className={styles['heading']}>{t('cards.cardSettings')}</h3>
      <SizeSection draft={draft} onChange={onChange} />
      <BackgroundSection draft={draft} onChange={onChange} />
      <AccentSection draft={draft} onChange={onChange} />
      <BorderSection draft={draft} onChange={onChange} />
      <TextSection draft={draft} onChange={onChange} />
    </div>
  );
}
