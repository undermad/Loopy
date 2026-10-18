import { useState } from 'react';
import type { CardValue, ItemStyle } from '@shared/board';
import { CARD_FIELD_KINDS, CARD_SPANS, CARD_TEXT_SIZES, type CardField } from '@shared/cards';
import type { ColourValue } from '@shared/colours';
import { resolveItemStyle } from '@renderer/lib/board';
import { FIELD_KINDS, coerceValue } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { Button, Field, Input, Select, Switch, TextArea } from '@renderer/ui';
import { ProjectColourPicker } from '../../../ProjectColourPicker/ProjectColourPicker';
import { NumberField } from '../../Properties/NumberField';
import type { TemplateDraft } from './TemplateEditorDialog';
import styles from './TemplateEditorDialog.module.scss';

const DEFAULT = 'default';

function ColourRow({
  label,
  value,
  fallback,
  resetLabel,
  onChange,
}: {
  label: string;
  value: ColourValue | null | undefined;
  fallback: string;
  resetLabel: string;
  onChange: (value: ColourValue | null) => void;
}) {
  return (
    <div className={styles['colourRow']}>
      <ProjectColourPicker
        size="sm"
        value={value ?? { hex: fallback, ref: null }}
        label={label}
        onChange={onChange}
      />
      <span>{label}</span>
      {value ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onChange(null);
          }}
        >
          {resetLabel}
        </Button>
      ) : null}
    </div>
  );
}

function DefaultValue({ field, onChange }: { field: CardField; onChange: (value: CardValue) => void }) {
  const { t } = useTranslation('editors');
  const kind = FIELD_KINDS[field.kind].value;
  const [draft, setDraft] = useState<string | null>(null);
  if (kind === 'none' || field.kind === 'image') return null;
  if (kind === 'boolean') {
    return (
      <Switch
        size="sm"
        label={t('cards.defaultValue')}
        checked={field.defaultValue === true}
        onCheckedChange={(checked) => {
          onChange(checked);
        }}
      />
    );
  }
  if (field.kind === 'select') {
    return (
      <Field label={t('cards.defaultValue')}>
        <Select
          size="sm"
          value={typeof field.defaultValue === 'string' ? field.defaultValue : DEFAULT}
          options={[
            { value: DEFAULT, label: '–' },
            ...field.options.map((option) => ({ value: option, label: option })),
          ]}
          onValueChange={(value) => {
            onChange(value === DEFAULT ? null : value);
          }}
        />
      </Field>
    );
  }
  const current =
    kind === 'list'
      ? Array.isArray(field.defaultValue)
        ? field.defaultValue.join(', ')
        : ''
      : field.defaultValue === null
        ? ''
        : String(field.defaultValue);
  return (
    <Field label={t('cards.defaultValue')}>
      <Input
        size="sm"
        type={kind === 'number' ? 'number' : 'text'}
        value={draft ?? current}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={() => {
          if (draft !== null) {
            const raw = kind === 'list' ? draft.split(',') : draft;
            onChange(draft.trim() === '' ? null : coerceValue(field, raw));
          }
          setDraft(null);
        }}
      />
    </Field>
  );
}

export function FieldSettings({
  field,
  onChange,
}: {
  field: CardField;
  onChange: (next: Partial<CardField>) => void;
}) {
  const { t } = useTranslation('editors');
  const [options, setOptions] = useState<string | null>(null);
  const textual = ['heading', 'text', 'longText', 'select'].includes(field.kind);
  const ranged = field.kind === 'number' || field.kind === 'stat';

  return (
    <div className={styles['settingsBody']}>
      <h3 className={styles['heading']}>{t('cards.fieldSettings')}</h3>
      <Field label={t('cards.kind')}>
        <Select
          size="sm"
          value={field.kind}
          aria-label={t('cards.fieldSettings')}
          options={CARD_FIELD_KINDS.map((kind) => ({ value: kind, label: t(`cards.kinds.${kind}`) }))}
          onValueChange={(value) => {
            onChange({ kind: value as CardField['kind'], defaultValue: null });
          }}
        />
      </Field>
      <Field label={t('cards.label')}>
        <Input
          size="sm"
          value={field.label}
          maxLength={80}
          onChange={(event) => {
            onChange({ label: event.target.value });
          }}
        />
      </Field>
      <Switch
        size="sm"
        label={t('cards.showLabel')}
        checked={field.showLabel}
        onCheckedChange={(checked) => {
          onChange({ showLabel: checked });
        }}
      />
      <Field label={t('cards.span')}>
        <Select
          size="sm"
          value={String(field.span)}
          options={CARD_SPANS.map((span) => ({
            value: String(span),
            label: t(`cards.spans.${String(span) as '12'}`),
          }))}
          onValueChange={(value) => {
            onChange({ span: Number(value) });
          }}
        />
      </Field>
      {textual ? (
        <Field label={t('cards.placeholder')}>
          <Input
            size="sm"
            value={field.placeholder}
            maxLength={120}
            onChange={(event) => {
              onChange({ placeholder: event.target.value });
            }}
          />
        </Field>
      ) : null}
      {field.kind === 'select' ? (
        <Field label={t('cards.options')} hint={t('cards.optionsHint')}>
          <TextArea
            rows={4}
            value={options ?? field.options.join('\n')}
            onChange={(event) => {
              setOptions(event.target.value);
            }}
            onBlur={() => {
              if (options !== null) {
                const next = [
                  ...new Set(
                    options
                      .split('\n')
                      .map((item) => item.trim())
                      .filter(Boolean),
                  ),
                ].slice(0, 30);
                onChange({ options: next.map((item) => item.slice(0, 40)) });
              }
              setOptions(null);
            }}
          />
        </Field>
      ) : null}
      {ranged ? (
        <div className={styles['pair']}>
          <NumberField
            label={t('cards.min')}
            value={field.min ?? 0}
            step={1}
            onCommit={(value) => {
              onChange({ min: value });
            }}
          />
          <NumberField
            label={t('cards.max')}
            value={field.max ?? 100}
            step={1}
            onCommit={(value) => {
              onChange({ max: value });
            }}
          />
        </div>
      ) : null}
      <DefaultValue
        field={field}
        onChange={(value) => {
          onChange({ defaultValue: value });
        }}
      />
      {field.kind !== 'divider' && field.kind !== 'image' ? (
        <>
          <h3 className={styles['heading']}>{t('properties.typography')}</h3>
          <div className={styles['pair']}>
            <Field label={t('cards.textSize')}>
              <Select
                size="sm"
                value={field.style.size ?? DEFAULT}
                options={[
                  { value: DEFAULT, label: '–' },
                  ...CARD_TEXT_SIZES.map((size) => ({ value: size, label: t(`cards.sizes.${size}`) })),
                ]}
                onValueChange={(value) => {
                  const { size: _size, ...rest } = field.style;
                  onChange({
                    style: value === DEFAULT ? rest : { ...rest, size: value as CardField['style']['size'] },
                  });
                }}
              />
            </Field>
            <Field label={t('cards.weight')}>
              <Select
                size="sm"
                value={field.style.weight ?? DEFAULT}
                options={[
                  { value: DEFAULT, label: '–' },
                  ...(['normal', 'medium', 'bold'] as const).map((weight) => ({
                    value: weight,
                    label: t(`properties.weights.${weight}`),
                  })),
                ]}
                onValueChange={(value) => {
                  const { weight: _weight, ...rest } = field.style;
                  onChange({
                    style:
                      value === DEFAULT ? rest : { ...rest, weight: value as CardField['style']['weight'] },
                  });
                }}
              />
            </Field>
          </div>
          <Field label={t('cards.align')}>
            <Select
              size="sm"
              value={field.style.align ?? DEFAULT}
              options={[
                { value: DEFAULT, label: '–' },
                ...(['left', 'center', 'right'] as const).map((align) => ({
                  value: align,
                  label: t(`properties.aligns.${align}`),
                })),
              ]}
              onValueChange={(value) => {
                const { align: _align, ...rest } = field.style;
                onChange({
                  style: value === DEFAULT ? rest : { ...rest, align: value as CardField['style']['align'] },
                });
              }}
            />
          </Field>
          <ColourRow
            label={t('cards.colour')}
            value={field.style.colour}
            fallback="#1a1a1a"
            resetLabel={t('properties.resetFill')}
            onChange={(colour) => {
              onChange({ style: { ...field.style, colour } });
            }}
          />
        </>
      ) : null}
    </div>
  );
}

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
