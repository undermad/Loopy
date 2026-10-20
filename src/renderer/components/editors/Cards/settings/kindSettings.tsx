import { createElement, type ComponentType, type ReactNode } from 'react';
import { BOARD_LINK_KINDS } from '@shared/board';
import {
  CARD_MAX_ROWS,
  NUMBER_DISPLAYS,
  RATING_SYMBOLS,
  TEXT_LINES,
  type CardField,
  type CardFieldKind,
  type FieldOf,
} from '@shared/cards';
import { computeFormulas, symbolCount, uniqueFieldId } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { Field, Select, Switch, ToggleGroup } from '@renderer/ui';
import { NumberField } from '../../Properties/NumberField';
import {
  BooleanDefault,
  BoundsInput,
  ChoiceDefault,
  DraftArea,
  DraftInput,
  LinesInput,
  NONE,
  NumberDefault,
} from './inputs';
import { OptionsEditor } from './OptionsEditor';
import styles from '../CardDesigner.module.scss';

export interface KindSettingsProps<F extends CardField = CardField> {
  field: F;
  fields: readonly CardField[];
  onChange: (next: F) => void;
}

function TextSettings({ field, onChange }: KindSettingsProps<FieldOf<'text'>>) {
  const { t } = useTranslation('editors');
  return (
    <>
      <Switch
        size="sm"
        label={t('cards.fixedText')}
        checked={field.fixed}
        onCheckedChange={(fixed) => {
          onChange({ ...field, fixed });
        }}
      />
      <Field label={t('cards.lines')}>
        <ToggleGroup
          size="sm"
          aria-label={t('cards.lines')}
          value={field.lines}
          items={TEXT_LINES.map((lines) => ({ value: lines, label: t(`cards.lineKinds.${lines}`) }))}
          onValueChange={(lines) => {
            onChange({ ...field, lines: lines as FieldOf<'text'>['lines'] });
          }}
        />
      </Field>
      {field.fixed ? (
        <DraftArea
          label={t('cards.staticText')}
          value={field.text}
          maxLength={2000}
          onCommit={(text) => {
            onChange({ ...field, text });
          }}
        />
      ) : (
        <>
          <DraftInput
            label={t('cards.placeholder')}
            value={field.placeholder}
            maxLength={120}
            onCommit={(placeholder) => {
              onChange({ ...field, placeholder });
            }}
          />
          <DraftInput
            label={t('cards.defaultValue')}
            value={field.defaultValue ?? ''}
            onCommit={(value) => {
              onChange({ ...field, defaultValue: value.trim() === '' ? null : value.slice(0, 5000) });
            }}
          />
        </>
      )}
    </>
  );
}

function AffixInputs<F extends FieldOf<'number' | 'formula'>>({
  field,
  onChange,
}: Pick<KindSettingsProps<F>, 'field' | 'onChange'>) {
  const { t } = useTranslation('editors');
  return (
    <div className={styles['pair']}>
      <DraftInput
        label={t('cards.prefix')}
        value={field.prefix}
        maxLength={12}
        onCommit={(prefix) => {
          onChange({ ...field, prefix });
        }}
      />
      <DraftInput
        label={t('cards.suffix')}
        value={field.suffix}
        maxLength={12}
        onCommit={(suffix) => {
          onChange({ ...field, suffix });
        }}
      />
    </div>
  );
}

function SymbolSettings({
  field,
  onChange,
}: Pick<KindSettingsProps<FieldOf<'number'>>, 'field' | 'onChange'>) {
  const { t } = useTranslation('editors');
  return (
    <div className={styles['pair']}>
      <NumberField
        label={t('cards.max')}
        value={symbolCount(field)}
        min={1}
        step={1}
        digits={0}
        onCommit={(max) => {
          onChange({ ...field, max: Math.min(10, Math.max(1, Math.round(max))) });
        }}
      />
      <Field label={t('cards.symbol')}>
        <Select
          size="sm"
          value={field.symbol}
          aria-label={t('cards.symbol')}
          options={RATING_SYMBOLS.map((symbol) => ({ value: symbol, label: t(`cards.symbols.${symbol}`) }))}
          onValueChange={(symbol) => {
            onChange({ ...field, symbol: symbol as FieldOf<'number'>['symbol'] });
          }}
        />
      </Field>
    </div>
  );
}

function NumberSettings({ field, onChange }: KindSettingsProps<FieldOf<'number'>>) {
  const { t } = useTranslation('editors');
  const symbols = field.display === 'symbols' && !field.range;
  return (
    <>
      <Switch
        size="sm"
        label={t('cards.range')}
        checked={field.range}
        onCheckedChange={(range) => {
          onChange({ ...field, range, display: 'number', defaultValue: null });
        }}
      />
      {field.range ? null : (
        <Field label={t('cards.display')}>
          <ToggleGroup
            size="sm"
            aria-label={t('cards.display')}
            value={field.display}
            items={NUMBER_DISPLAYS.map((display) => ({
              value: display,
              label: t(`cards.displays.${display}`),
            }))}
            onValueChange={(display) => {
              onChange({ ...field, display: display as FieldOf<'number'>['display'] });
            }}
          />
        </Field>
      )}
      {symbols ? (
        <SymbolSettings field={field} onChange={onChange} />
      ) : (
        <BoundsInput
          min={field.min}
          max={field.max}
          {...(field.display === 'bar' ? { fallback: { min: 0, max: 100 } } : {})}
          onCommit={(bounds) => {
            onChange({ ...field, ...bounds });
          }}
        />
      )}
      {field.range ? null : (
        <NumberDefault
          value={typeof field.defaultValue === 'number' ? field.defaultValue : null}
          onCommit={(defaultValue) => {
            onChange({ ...field, defaultValue });
          }}
        />
      )}
      {symbols ? null : <AffixInputs field={field} onChange={onChange} />}
    </>
  );
}

function AttributesSettings({ field, onChange }: KindSettingsProps<FieldOf<'attributes'>>) {
  const { t } = useTranslation('editors');
  return (
    <LinesInput
      label={t('cards.attributeRows')}
      hint={t('cards.attributeRowsHint')}
      value={field.rows.map((row) => row.label)}
      onCommit={(labels) => {
        const rows: FieldOf<'attributes'>['rows'] = [];
        for (const label of labels.slice(0, CARD_MAX_ROWS)) {
          const short = label.slice(0, 40);
          const existing = field.rows.find((row) => row.label === short);
          rows.push(existing ?? { id: uniqueFieldId(short, rows, 'attribute'), label: short });
        }
        onChange({ ...field, rows });
      }}
    />
  );
}

function formulaMessage(
  t: ReturnType<typeof useTranslation<'editors'>>['t'],
  result: ReturnType<typeof computeFormulas>[string] | undefined,
): string | undefined {
  if (!result || !('error' in result) || result.error === 'empty') return undefined;
  if (result.error === 'unknown' && result.name) return t('cards.formulaUnknown', { name: result.name });
  if (result.error === 'cycle') return t('cards.formulaCycle');
  return t('cards.formulaError');
}

function FormulaSettings({ field, fields, onChange }: KindSettingsProps<FieldOf<'formula'>>) {
  const { t } = useTranslation('editors');
  const others = fields.filter((item) => item.id !== field.id);
  const usable = others.filter(
    (item) => (item.kind === 'number' && !item.range) || item.kind === 'checkbox' || item.kind === 'formula',
  );
  const result = computeFormulas([...others, field], {})[field.id];
  const error = formulaMessage(t, result);
  return (
    <>
      <DraftArea
        label={t('cards.formula')}
        hint={t('cards.formulaHint')}
        value={field.expression}
        maxLength={500}
        {...(error ? { error } : {})}
        onCommit={(expression) => {
          onChange({ ...field, expression });
        }}
      />
      {usable.length > 0 ? (
        <div className={styles['formulaFields']}>
          <span>{t('cards.formulaFields')}</span>
          {usable.map((item) => (
            <code key={item.id}>{item.id}</code>
          ))}
        </div>
      ) : null}
      <Field label={t('cards.decimals')}>
        <Select
          size="sm"
          value={field.decimals === null ? NONE : String(field.decimals)}
          options={[
            { value: NONE, label: t('cards.autoDecimals') },
            ...[0, 1, 2, 3, 4, 5, 6].map((count) => ({ value: String(count), label: String(count) })),
          ]}
          onValueChange={(value) => {
            onChange({ ...field, decimals: value === NONE ? null : Number(value) });
          }}
        />
      </Field>
      <AffixInputs field={field} onChange={onChange} />
    </>
  );
}

function DiceSettings({ field, onChange }: KindSettingsProps<FieldOf<'dice'>>) {
  const { t } = useTranslation('editors');
  return (
    <DraftInput
      label={t('cards.defaultValue')}
      value={field.defaultValue ?? ''}
      maxLength={40}
      onCommit={(value) => {
        onChange({ ...field, defaultValue: value.trim() === '' ? null : value.trim() });
      }}
    />
  );
}

function listOf(value: string | string[] | null): string[] {
  if (value === null) return [];
  return typeof value === 'string' ? [value] : value;
}

function ChoiceSettings({ field, onChange }: KindSettingsProps<FieldOf<'choice'>>) {
  const { t } = useTranslation('editors');
  const values = field.options.map((option) => option.value);
  const defaults = listOf(field.defaultValue);
  const shape = (items: string[]) => (field.multiple ? (items.length ? items : null) : (items[0] ?? null));
  return (
    <>
      <Switch
        size="sm"
        label={t('cards.multiple')}
        checked={field.multiple}
        onCheckedChange={(multiple) => {
          const defaultValue = multiple ? (defaults.length ? defaults : null) : (defaults[0] ?? null);
          onChange({ ...field, multiple, defaultValue });
        }}
      />
      <Switch
        size="sm"
        label={t('cards.allowNew')}
        checked={field.allowNew}
        onCheckedChange={(allowNew) => {
          onChange({ ...field, allowNew });
        }}
      />
      {field.multiple ? null : (
        <DraftInput
          label={t('cards.placeholder')}
          value={field.placeholder}
          maxLength={120}
          onCommit={(placeholder) => {
            onChange({ ...field, placeholder });
          }}
        />
      )}
      <OptionsEditor
        options={field.options}
        onChange={(options) => {
          const kept = options.map((option) => option.value);
          onChange({
            ...field,
            options,
            defaultValue: shape(defaults.filter((item) => field.allowNew || kept.includes(item))),
          });
        }}
      />
      {field.multiple || field.allowNew ? (
        <DraftInput
          label={t('cards.defaultValue')}
          {...(field.multiple ? { hint: t('cards.commaHint') } : {})}
          value={defaults.join(', ')}
          onCommit={(raw) => {
            const items = (field.multiple ? raw.split(',') : [raw])
              .map((item) => item.trim().slice(0, 80))
              .filter(Boolean)
              .slice(0, 50);
            onChange({ ...field, defaultValue: shape(items) });
          }}
        />
      ) : (
        <ChoiceDefault
          options={values}
          value={typeof field.defaultValue === 'string' ? field.defaultValue : null}
          onCommit={(defaultValue) => {
            onChange({ ...field, defaultValue });
          }}
        />
      )}
    </>
  );
}

function CheckboxSettings({ field, onChange }: KindSettingsProps<FieldOf<'checkbox'>>) {
  return (
    <BooleanDefault
      value={field.defaultValue}
      onCommit={(defaultValue) => {
        onChange({ ...field, defaultValue });
      }}
    />
  );
}

function ColourSettings({ field, onChange }: KindSettingsProps<FieldOf<'colour'>>) {
  const { t } = useTranslation('editors');
  return (
    <DraftInput
      label={t('cards.defaultValue')}
      value={field.defaultValue ?? ''}
      onCommit={(raw) => {
        const hex = raw.trim().toLowerCase();
        onChange({ ...field, defaultValue: /^#[0-9a-f]{6}$/.test(hex) ? hex : null });
      }}
    />
  );
}

function LinkSettings({ field, onChange }: KindSettingsProps<FieldOf<'link'>>) {
  const { t } = useTranslation('editors');
  const allowed = field.linkKinds.length === 0 ? [...BOARD_LINK_KINDS] : field.linkKinds;
  return (
    <fieldset className={styles['linkKinds']}>
      <legend className={styles['heading']}>{t('cards.linkKinds')}</legend>
      {BOARD_LINK_KINDS.map((kind) => {
        const on = allowed.includes(kind);
        return (
          <Switch
            key={kind}
            size="sm"
            label={t(`cards.linkKindNames.${kind}`)}
            checked={on}
            disabled={on && allowed.length === 1}
            onCheckedChange={(checked) => {
              const next = BOARD_LINK_KINDS.filter((item) =>
                item === kind ? checked : allowed.includes(item),
              );
              onChange({ ...field, linkKinds: next.length === BOARD_LINK_KINDS.length ? [] : next });
            }}
          />
        );
      })}
      <Switch
        size="sm"
        label={t('cards.multiple')}
        checked={field.multiple}
        onCheckedChange={(multiple) => {
          onChange({ ...field, multiple });
        }}
      />
    </fieldset>
  );
}

function SeparatorSettings({ field, onChange }: KindSettingsProps<FieldOf<'separator'>>) {
  const { t } = useTranslation('editors');
  return (
    <>
      <Switch
        size="sm"
        label={t('cards.line')}
        checked={field.line}
        onCheckedChange={(line) => {
          onChange({ ...field, line });
        }}
      />
      <NumberField
        label={t('cards.spacerSize')}
        value={field.size}
        min={4}
        step={4}
        digits={0}
        onCommit={(size) => {
          onChange({ ...field, size: Math.min(200, Math.max(4, size)) });
        }}
      />
    </>
  );
}

type KindSettingsMap = { [K in CardFieldKind]: ComponentType<KindSettingsProps<FieldOf<K>>> | null };

const KIND_SETTINGS: KindSettingsMap = {
  text: TextSettings,
  date: null,
  number: NumberSettings,
  attributes: AttributesSettings,
  formula: FormulaSettings,
  dice: DiceSettings,
  choice: ChoiceSettings,
  checkbox: CheckboxSettings,
  checklist: null,
  image: null,
  icon: null,
  colour: ColourSettings,
  link: LinkSettings,
  separator: SeparatorSettings,
};

export function hasKindSettings(field: CardField): boolean {
  return KIND_SETTINGS[field.kind] !== null;
}

export function renderKindSettings(props: KindSettingsProps): ReactNode {
  const settings = KIND_SETTINGS[props.field.kind] as ComponentType<KindSettingsProps> | null;
  return settings ? createElement(settings, props) : null;
}
