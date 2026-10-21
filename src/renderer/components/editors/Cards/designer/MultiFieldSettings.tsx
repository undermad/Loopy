import { Copy, Trash2 } from 'lucide-react';
import { CARD_SPANS, CARD_TEXT_SIZES, CARD_ZONES, type CardField } from '@shared/cards';
import { clampSpan } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { Button, Field, PropertySection, Select, Switch, ToggleGroup } from '@renderer/ui';
import { NumberField } from '../../Properties/NumberField';
import styles from '../CardDesigner.module.scss';

const MIXED = '__mixed';
const NONE = 'default';

function shared<T>(fields: readonly CardField[], read: (field: CardField) => T): T | typeof MIXED {
  const first = fields[0];
  if (!first) return MIXED;
  const value = read(first);
  return fields.every((field) => read(field) === value) ? value : MIXED;
}

export function MultiFieldSettings({
  fields,
  onChange,
  onDuplicate,
  onRemove,
}: {
  fields: CardField[];
  onChange: (change: (field: CardField) => CardField) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('editors');
  const span = shared(fields, (field) => field.span);
  const zone = shared(fields, (field) => field.zone);
  const size = shared(fields, (field) => field.style.size ?? NONE);
  const every = (read: (field: CardField) => boolean) => fields.every(read);
  return (
    <div className={styles['settingsBody']}>
      <h3 className={styles['heading']}>{t('cards.fieldsSelected', { count: fields.length })}</h3>
      <PropertySection title={t('cards.sections.layout')}>
        <NumberField
          label={t('cards.span')}
          value={span === MIXED ? 12 : span}
          min={1}
          step={1}
          digits={0}
          onCommit={(next) => {
            onChange((field) => ({ ...field, span: clampSpan(next) }));
          }}
        />
        <ToggleGroup
          size="sm"
          aria-label={t('cards.widthPresets')}
          value={span === MIXED ? '' : String(span)}
          items={CARD_SPANS.map((item) => ({
            value: String(item),
            label: t(`cards.spans.${String(item) as '12'}`),
          }))}
          onValueChange={(next) => {
            onChange((field) => ({ ...field, span: Number(next) }));
          }}
        />
        <Field label={t('cards.zone')}>
          <Select
            size="sm"
            aria-label={t('cards.zone')}
            value={zone === MIXED ? MIXED : zone}
            options={[
              ...(zone === MIXED ? [{ value: MIXED, label: t('cards.mixed') }] : []),
              ...CARD_ZONES.map((item) => ({ value: item, label: t(`cards.zones.${item}`) })),
            ]}
            onValueChange={(next) => {
              if (next !== MIXED) onChange((field) => ({ ...field, zone: next as CardField['zone'] }));
            }}
          />
        </Field>
      </PropertySection>
      <PropertySection title={t('cards.sections.textStyle')}>
        <Switch
          size="sm"
          label={t('cards.showLabel')}
          checked={every((field) => field.showLabel)}
          onCheckedChange={(showLabel) => {
            onChange((field) => ({ ...field, showLabel }));
          }}
        />
        <Field label={t('cards.textSize')}>
          <Select
            size="sm"
            aria-label={t('cards.textSize')}
            value={size}
            options={[
              ...(size === MIXED ? [{ value: MIXED, label: t('cards.mixed') }] : []),
              { value: NONE, label: '–' },
              ...CARD_TEXT_SIZES.map((item) => ({ value: item, label: t(`cards.sizes.${item}`) })),
            ]}
            onValueChange={(next) => {
              if (next === MIXED) return;
              onChange((field) => {
                const { size: _old, ...style } = field.style;
                return {
                  ...field,
                  style: next === NONE ? style : { ...style, size: next as (typeof CARD_TEXT_SIZES)[number] },
                };
              });
            }}
          />
        </Field>
      </PropertySection>
      <PropertySection title={t('cards.sections.advanced')}>
        <Switch
          size="sm"
          label={t('cards.hidden')}
          checked={every((field) => field.hidden)}
          onCheckedChange={(hidden) => {
            onChange((field) => ({ ...field, hidden }));
          }}
        />
        <Switch
          size="sm"
          label={t('cards.lockField')}
          checked={every((field) => field.locked)}
          onCheckedChange={(locked) => {
            onChange((field) => ({ ...field, locked }));
          }}
        />
      </PropertySection>
      <div className={styles['pair']}>
        <Button size="sm" variant="ghost" icon={<Copy aria-hidden="true" />} onClick={onDuplicate}>
          {t('cards.duplicateFields')}
        </Button>
        <Button size="sm" variant="ghost" icon={<Trash2 aria-hidden="true" />} onClick={onRemove}>
          {t('cards.deleteFields')}
        </Button>
      </div>
    </div>
  );
}
