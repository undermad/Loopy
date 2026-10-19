import { createElement, type ComponentType, type ReactNode } from 'react';
import { BOARD_LINK_KINDS } from '@shared/board';
import { CARD_MAX_OPTIONS, type CardField, type CardFieldKind, type FieldOf } from '@shared/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { Switch } from '@renderer/ui';
import { BooleanDefault, BoundsInput, ChoiceDefault, DraftInput, LinesInput, NumberDefault } from './inputs';
import styles from '../CardDesigner.module.scss';

export interface KindSettingsProps<F extends CardField = CardField> {
  field: F;
  onChange: (next: F) => void;
}

function TextSettings<F extends FieldOf<'heading' | 'text' | 'longText'>>({
  field,
  onChange,
}: KindSettingsProps<F>) {
  const { t } = useTranslation('editors');
  return (
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
  );
}

function NumberSettings<F extends FieldOf<'number' | 'stat'>>({ field, onChange }: KindSettingsProps<F>) {
  return (
    <>
      <BoundsInput
        min={field.min}
        max={field.max}
        onCommit={(bounds) => {
          onChange({ ...field, ...bounds });
        }}
      />
      <NumberDefault
        value={field.defaultValue}
        onCommit={(defaultValue) => {
          onChange({ ...field, defaultValue });
        }}
      />
    </>
  );
}

function SelectSettings({ field, onChange }: KindSettingsProps<FieldOf<'select'>>) {
  const { t } = useTranslation('editors');
  return (
    <>
      <DraftInput
        label={t('cards.placeholder')}
        value={field.placeholder}
        maxLength={120}
        onCommit={(placeholder) => {
          onChange({ ...field, placeholder });
        }}
      />
      <LinesInput
        label={t('cards.options')}
        hint={t('cards.optionsHint')}
        value={field.options}
        onCommit={(lines) => {
          const options = lines.slice(0, CARD_MAX_OPTIONS).map((item) => item.slice(0, 40));
          const defaultValue =
            field.defaultValue !== null && options.includes(field.defaultValue) ? field.defaultValue : null;
          onChange({ ...field, options, defaultValue });
        }}
      />
      <ChoiceDefault
        options={field.options}
        value={field.defaultValue}
        onCommit={(defaultValue) => {
          onChange({ ...field, defaultValue });
        }}
      />
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

function TagsSettings({ field, onChange }: KindSettingsProps<FieldOf<'tags'>>) {
  const { t } = useTranslation('editors');
  return (
    <DraftInput
      label={t('cards.defaultValue')}
      value={(field.defaultValue ?? []).join(', ')}
      onCommit={(raw) => {
        const tags = raw
          .split(',')
          .map((item) => item.trim().slice(0, 80))
          .filter(Boolean)
          .slice(0, 50);
        onChange({ ...field, defaultValue: tags.length > 0 ? tags : null });
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

type KindSettingsMap = { [K in CardFieldKind]: ComponentType<KindSettingsProps<FieldOf<K>>> | null };

const KIND_SETTINGS: KindSettingsMap = {
  heading: TextSettings,
  text: TextSettings,
  longText: TextSettings,
  number: NumberSettings,
  stat: NumberSettings,
  select: SelectSettings,
  checkbox: CheckboxSettings,
  tags: TagsSettings,
  image: null,
  colour: ColourSettings,
  link: LinkSettings,
  divider: null,
};

export function renderKindSettings(props: KindSettingsProps): ReactNode {
  const settings = KIND_SETTINGS[props.field.kind] as ComponentType<KindSettingsProps> | null;
  return settings ? createElement(settings, props) : null;
}
