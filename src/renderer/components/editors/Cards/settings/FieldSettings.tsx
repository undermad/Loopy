import { FONT_WEIGHTS, TEXT_ALIGNS } from '@shared/board';
import { CARD_SPANS, CARD_TEXT_SIZES, type CardField } from '@shared/cards';
import { FIELD_KINDS, changeFieldKind, fieldKindsByGroup } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { Field, Input, Select, Switch } from '@renderer/ui';
import { ColourRow } from './ColourRow';
import { NONE } from './inputs';
import { renderKindSettings } from './kindSettings';
import styles from '../CardDesigner.module.scss';

function withStyle<K extends keyof CardField['style']>(
  field: CardField,
  key: K,
  value: CardField['style'][K] | undefined,
): CardField {
  const { [key]: _removed, ...rest } = field.style;
  return { ...field, style: value === undefined ? rest : { ...rest, [key]: value } };
}

function TextStyleSettings({ field, onChange }: { field: CardField; onChange: (next: CardField) => void }) {
  const { t } = useTranslation('editors');
  const pick = (key: 'size' | 'weight' | 'align') => (value: string) => {
    const next = value === NONE ? undefined : (value as CardField['style'][typeof key]);
    onChange(withStyle(field, key, next));
  };
  return (
    <>
      <h3 className={styles['heading']}>{t('properties.typography')}</h3>
      <div className={styles['pair']}>
        <Field label={t('cards.textSize')}>
          <Select
            size="sm"
            value={field.style.size ?? NONE}
            options={[
              { value: NONE, label: '–' },
              ...CARD_TEXT_SIZES.map((size) => ({ value: size, label: t(`cards.sizes.${size}`) })),
            ]}
            onValueChange={pick('size')}
          />
        </Field>
        <Field label={t('cards.weight')}>
          <Select
            size="sm"
            value={field.style.weight ?? NONE}
            options={[
              { value: NONE, label: '–' },
              ...FONT_WEIGHTS.map((weight) => ({ value: weight, label: t(`properties.weights.${weight}`) })),
            ]}
            onValueChange={pick('weight')}
          />
        </Field>
      </div>
      <Field label={t('cards.align')}>
        <Select
          size="sm"
          value={field.style.align ?? NONE}
          options={[
            { value: NONE, label: '–' },
            ...TEXT_ALIGNS.map((align) => ({ value: align, label: t(`properties.aligns.${align}`) })),
          ]}
          onValueChange={pick('align')}
        />
      </Field>
      <ColourRow
        label={t('cards.colour')}
        value={field.style.colour}
        fallback="#1a1a1a"
        resetLabel={t('properties.resetFill')}
        onChange={(colour) => {
          onChange(withStyle(field, 'colour', colour));
        }}
      />
    </>
  );
}

export function FieldSettings({
  field,
  onChange,
}: {
  field: CardField;
  onChange: (next: CardField) => void;
}) {
  const { t } = useTranslation('editors');
  return (
    <div className={styles['settingsBody']}>
      <h3 className={styles['heading']}>{t('cards.fieldSettings')}</h3>
      <Field label={t('cards.kind')}>
        <Select
          size="sm"
          value={field.kind}
          aria-label={t('cards.kind')}
          options={fieldKindsByGroup().flatMap((group) =>
            group.kinds.map((kind) => ({ value: kind, label: t(`cards.kinds.${kind}`) })),
          )}
          onValueChange={(kind) => {
            onChange(changeFieldKind(field, kind as CardField['kind']));
          }}
        />
      </Field>
      <Field label={t('cards.label')}>
        <Input
          size="sm"
          value={field.label}
          maxLength={80}
          onChange={(event) => {
            onChange({ ...field, label: event.target.value });
          }}
        />
      </Field>
      <Switch
        size="sm"
        label={t('cards.showLabel')}
        checked={field.showLabel}
        onCheckedChange={(showLabel) => {
          onChange({ ...field, showLabel });
        }}
      />
      {renderKindSettings({ field, onChange })}
      <Field label={t('cards.span')}>
        <Select
          size="sm"
          value={String(field.span)}
          options={CARD_SPANS.map((span) => ({
            value: String(span),
            label: t(`cards.spans.${String(span) as '12'}`),
          }))}
          onValueChange={(value) => {
            onChange({ ...field, span: Number(value) });
          }}
        />
      </Field>
      {FIELD_KINDS[field.kind].textStyle ? <TextStyleSettings field={field} onChange={onChange} /> : null}
    </div>
  );
}
