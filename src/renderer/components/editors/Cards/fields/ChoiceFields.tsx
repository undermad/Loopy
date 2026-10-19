import { useState, type CSSProperties } from 'react';
import { X } from 'lucide-react';
import type { ChecklistItem } from '@shared/board';
import type { ChoiceOption, FieldOf } from '@shared/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { useResolvedColour } from '@renderer/lib/palettes';
import { cx } from '@renderer/ui';
import { INTERACTIVE, stop, type FieldViewProps } from './inputs';
import styles from '../CardView.module.scss';

function ChoiceBadge({ option, style }: { option: ChoiceOption | undefined; style?: CSSProperties }) {
  const colour = useResolvedColour(option?.colour ?? null);
  return (
    <span
      className={cx(styles['badge'], colour && styles['badgeTinted'])}
      style={{ ...style, ...(colour ? { '--badge-colour': colour } : {}) }}
    >
      {option?.value ?? '–'}
    </span>
  );
}

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
    return <ChoiceBadge option={field.options.find((option) => option.value === text)} style={textStyle} />;
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
        <option key={option.value} value={option.value}>
          {option.value}
        </option>
      ))}
    </select>
  );
}

export function MultiSelectField({
  field,
  value,
  editable,
  label,
  textStyle,
  onChange,
}: FieldViewProps<FieldOf<'multiSelect'>>) {
  const picked = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  if (!editable) {
    return (
      <span className={styles['tags']} role="list" aria-label={label}>
        {picked.length === 0 ? <span className={styles['empty']}>–</span> : null}
        {field.options
          .filter((option) => picked.includes(option.value))
          .map((option) => (
            <span key={option.value} role="listitem">
              <ChoiceBadge option={option} style={textStyle} />
            </span>
          ))}
      </span>
    );
  }
  return (
    <span className={styles['tags']} role="group" aria-label={label}>
      {field.options.map((option) => {
        const on = picked.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            className={cx(INTERACTIVE, styles['chip'], on && styles['chipOn'])}
            style={textStyle}
            aria-pressed={on}
            onClick={() => {
              const next = on ? picked.filter((item) => item !== option.value) : [...picked, option.value];
              onChange(next.length > 0 ? next : null);
            }}
          >
            {option.value}
          </button>
        );
      })}
    </span>
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

function asChecklist(value: unknown): ChecklistItem[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is ChecklistItem =>
          typeof item === 'object' && item !== null && 'text' in item && 'done' in item,
      )
    : [];
}

export function ChecklistField({
  value,
  editable,
  label,
  textStyle,
  onChange,
}: FieldViewProps<FieldOf<'checklist'>>) {
  const { t } = useTranslation('editors');
  const items = asChecklist(value);
  const [draft, setDraft] = useState('');
  const done = items.filter((item) => item.done).length;
  const commit = (next: ChecklistItem[]) => {
    onChange(next.length > 0 ? next : null);
  };
  return (
    <div className={styles['checklist']} style={textStyle}>
      {items.length > 0 ? (
        <span className={styles['progress']}>{`${String(done)}/${String(items.length)}`}</span>
      ) : null}
      <ul className={styles['steps']} aria-label={label}>
        {items.map((item, index) => (
          <li
            key={`${item.text}-${String(index)}`}
            className={cx(styles['step'], item.done && styles['stepDone'])}
          >
            <label className={styles['check']}>
              <input
                className={INTERACTIVE}
                type="checkbox"
                checked={item.done}
                disabled={!editable}
                onChange={(event) => {
                  commit(
                    items.map((own, at) => (at === index ? { ...own, done: event.target.checked } : own)),
                  );
                }}
              />
              <span>{item.text}</span>
            </label>
            {editable ? (
              <button
                type="button"
                className={cx(INTERACTIVE, styles['tagRemove'])}
                aria-label={t('cards.removeStep', { text: item.text })}
                onClick={() => {
                  commit(items.filter((_own, at) => at !== index));
                }}
              >
                <X aria-hidden="true" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {editable ? (
        <input
          className={cx(INTERACTIVE, styles['tagInput'])}
          value={draft}
          placeholder={t('cards.addStep')}
          aria-label={`${label}: ${t('cards.addStep')}`}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter' && draft.trim()) {
              event.preventDefault();
              commit([...items, { text: draft.trim().slice(0, 200), done: false }]);
              setDraft('');
            }
          }}
        />
      ) : null}
    </div>
  );
}
