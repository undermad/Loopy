import { useState } from 'react';
import { X } from 'lucide-react';
import type { FieldOf } from '@shared/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { cx } from '@renderer/ui';
import { INTERACTIVE, stop, type FieldViewProps } from './inputs';
import styles from '../CardView.module.scss';

export function SelectField({
  field,
  value,
  editable,
  label,
  textStyle,
  onChange,
}: FieldViewProps<FieldOf<'select'>>) {
  const text = typeof value === 'string' ? value : '';
  if (!editable) {
    return (
      <span className={styles['badge']} style={textStyle}>
        {text || '–'}
      </span>
    );
  }
  return (
    <select
      className={cx(INTERACTIVE, styles['input'], styles['select'])}
      style={textStyle}
      value={text}
      aria-label={label}
      onKeyDown={stop}
      onChange={(event) => {
        onChange(event.target.value || null);
      }}
    >
      <option value="">{field.placeholder || '–'}</option>
      {field.options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

export function CheckboxField({
  value,
  editable,
  label,
  textStyle,
  onChange,
}: FieldViewProps<FieldOf<'checkbox'>>) {
  const { t } = useTranslation('editors');
  return (
    <label className={styles['check']} style={textStyle}>
      <input
        className={INTERACTIVE}
        type="checkbox"
        checked={value === true}
        disabled={!editable}
        aria-label={label}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      <span>{value === true ? t('cards.yes') : t('cards.no')}</span>
    </label>
  );
}

export function TagsField({ value, editable, label, onChange }: FieldViewProps<FieldOf<'tags'>>) {
  const { t } = useTranslation('editors');
  const tags = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  const [draft, setDraft] = useState('');
  return (
    <div className={styles['tags']} aria-label={label} role="list">
      {tags.map((tag) => (
        <span key={tag} className={styles['tag']} role="listitem">
          {tag}
          {editable ? (
            <button
              type="button"
              className={cx(INTERACTIVE, styles['tagRemove'])}
              aria-label={t('cards.removeTag', { tag })}
              onClick={() => {
                onChange(tags.filter((item) => item !== tag));
              }}
            >
              <X aria-hidden="true" />
            </button>
          ) : null}
        </span>
      ))}
      {editable ? (
        <input
          className={cx(INTERACTIVE, styles['tagInput'])}
          value={draft}
          placeholder={t('cards.addTag')}
          aria-label={`${label}: ${t('cards.addTag')}`}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter' && draft.trim()) {
              event.preventDefault();
              if (!tags.includes(draft.trim())) onChange([...tags, draft.trim()]);
              setDraft('');
            }
          }}
        />
      ) : null}
    </div>
  );
}
