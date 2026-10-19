import { useState } from 'react';
import { useTranslation } from '@renderer/lib/i18n';
import { Field, Input, Select, Switch, TextArea } from '@renderer/ui';
import { NumberField } from '../../Properties/NumberField';
import styles from '../CardDesigner.module.scss';

export const NONE = 'default';

export function DraftInput({
  label,
  value,
  type = 'text',
  maxLength,
  hint,
  onCommit,
}: {
  label: string;
  value: string;
  type?: 'text' | 'number';
  maxLength?: number;
  hint?: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Field label={label} {...(hint ? { hint } : {})}>
      <Input
        size="sm"
        type={type}
        value={draft ?? value}
        {...(maxLength ? { maxLength } : {})}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={() => {
          if (draft !== null && draft !== value) onCommit(draft);
          setDraft(null);
        }}
      />
    </Field>
  );
}

export function DraftArea({
  label,
  value,
  maxLength,
  hint,
  error,
  onCommit,
}: {
  label: string;
  value: string;
  maxLength: number;
  hint?: string;
  error?: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Field label={label} {...(hint ? { hint } : {})} {...(error ? { error } : {})}>
      <TextArea
        rows={3}
        value={draft ?? value}
        maxLength={maxLength}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={() => {
          if (draft !== null && draft !== value) onCommit(draft);
          setDraft(null);
        }}
      />
    </Field>
  );
}

export function LinesInput({
  label,
  hint,
  value,
  onCommit,
}: {
  label: string;
  hint: string;
  value: string[];
  onCommit: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Field label={label} hint={hint}>
      <TextArea
        rows={4}
        value={draft ?? value.join('\n')}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={() => {
          if (draft !== null) {
            onCommit([
              ...new Set(
                draft
                  .split('\n')
                  .map((item) => item.trim())
                  .filter(Boolean),
              ),
            ]);
          }
          setDraft(null);
        }}
      />
    </Field>
  );
}

export function NumberDefault({
  value,
  onCommit,
}: {
  value: number | null;
  onCommit: (next: number | null) => void;
}) {
  const { t } = useTranslation('editors');
  return (
    <DraftInput
      label={t('cards.defaultValue')}
      type="number"
      value={value === null ? '' : String(value)}
      onCommit={(raw) => {
        const parsed = Number(raw);
        onCommit(raw.trim() === '' || !Number.isFinite(parsed) ? null : parsed);
      }}
    />
  );
}

export function BoundsInput({
  min,
  max,
  fallback,
  onCommit,
}: {
  min: number | null;
  max: number | null;
  fallback?: { min: number; max: number };
  onCommit: (next: { min: number | null; max: number | null }) => void;
}) {
  const { t } = useTranslation('editors');
  return (
    <div className={styles['pair']}>
      <NumberField
        label={t('cards.min')}
        value={min ?? fallback?.min ?? 0}
        step={1}
        onCommit={(value) => {
          onCommit({ min: value, max });
        }}
      />
      <NumberField
        label={t('cards.max')}
        value={max ?? fallback?.max ?? 100}
        step={1}
        onCommit={(value) => {
          onCommit({ min, max: value });
        }}
      />
    </div>
  );
}

export function ChoiceDefault({
  options,
  value,
  onCommit,
}: {
  options: string[];
  value: string | null;
  onCommit: (next: string | null) => void;
}) {
  const { t } = useTranslation('editors');
  return (
    <Field label={t('cards.defaultValue')}>
      <Select
        size="sm"
        value={value ?? NONE}
        options={[
          { value: NONE, label: '–' },
          ...options.map((option) => ({ value: option, label: option })),
        ]}
        onValueChange={(next) => {
          onCommit(next === NONE ? null : next);
        }}
      />
    </Field>
  );
}

export function BooleanDefault({
  value,
  onCommit,
}: {
  value: boolean | null;
  onCommit: (next: boolean) => void;
}) {
  const { t } = useTranslation('editors');
  return (
    <Switch size="sm" label={t('cards.defaultValue')} checked={value === true} onCheckedChange={onCommit} />
  );
}
