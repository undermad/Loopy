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

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function ChoiceChips({ field, value, label, textStyle, onChange }: FieldViewProps<FieldOf<'choice'>>) {
  const text = typeof value === 'string' ? value : '';
  if (field.display === 'radio') {
    return (
      <span className={styles['radios']} role="radiogroup" aria-label={label}>
        {field.options.map((option) => (
          <label key={option.value} className={styles['check']} style={textStyle}>
            <input
              className={INTERACTIVE}
              type="radio"
              name={field.id}
              checked={text === option.value}
              onChange={() => {
                onChange(option.value);
              }}
            />
            <span>{option.value}</span>
          </label>
        ))}
      </span>
    );
  }
  return (
    <span className={styles['tags']} role="group" aria-label={label}>
      {field.options.map((option) => {
        const on = text === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={cx(INTERACTIVE, styles['chip'], on && styles['chipOn'])}
            style={textStyle}
            aria-pressed={on}
            onClick={() => {
              onChange(on ? null : option.value);
            }}
          >
            {option.value}
          </button>
        );
      })}
    </span>
  );
}

function SingleChoice(props: FieldViewProps<FieldOf<'choice'>>) {
  const { field, value, label, textStyle, onChange } = props;
  const text = typeof value === 'string' ? value : '';
  if (field.display !== 'dropdown' && !field.allowNew) return <ChoiceChips {...props} />;
  if (field.allowNew) {
    const list = `${field.id}-choices`;
    return (
      <>
        <input
          className={cx(INTERACTIVE, styles['input'])}
          style={textStyle}
          defaultValue={text}
          key={text}
          list={list}
          placeholder={field.placeholder}
          aria-label={label}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          onBlur={(event) => {
            const next = event.target.value.trim();
            if (next !== text) onChange(next || null);
          }}
        />
        <datalist id={list}>
          {field.options.map((option) => (
            <option key={option.value} value={option.value} />
          ))}
        </datalist>
      </>
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
        <option key={option.value} value={option.value}>
          {option.value}
        </option>
      ))}
    </select>
  );
}

function MultipleChoice({ field, value, label, textStyle, onChange }: FieldViewProps<FieldOf<'choice'>>) {
  const { t } = useTranslation('editors');
  const picked = strings(value);
  const known = field.options.map((option) => option.value);
  const extra = picked.filter((item) => !known.includes(item));
  const [draft, setDraft] = useState('');
  const commit = (next: string[]) => {
    onChange(next.length > 0 ? next : null);
  };
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
              commit(on ? picked.filter((item) => item !== option.value) : [...picked, option.value]);
            }}
          >
            {option.value}
          </button>
        );
      })}
      {extra.map((tag) => (
        <span key={tag} className={styles['tag']}>
          {tag}
          <button
            type="button"
            className={cx(INTERACTIVE, styles['tagRemove'])}
            aria-label={t('cards.removeTag', { tag })}
            onClick={() => {
              commit(picked.filter((item) => item !== tag));
            }}
          >
            <X aria-hidden="true" />
          </button>
        </span>
      ))}
      {field.allowNew ? (
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
            const next = draft.trim().slice(0, 80);
            if (event.key === 'Enter' && next) {
              event.preventDefault();
              if (!picked.includes(next)) commit([...picked, next]);
              setDraft('');
            }
          }}
        />
      ) : null}
    </span>
  );
}

export function ChoiceField(props: FieldViewProps<FieldOf<'choice'>>) {
  const { field, value, editable, label, textStyle } = props;
  if (editable) return field.multiple ? <MultipleChoice {...props} /> : <SingleChoice {...props} />;
  const picked = strings(value);
  const optionFor = (item: string) =>
    field.options.find((option) => option.value === item) ?? { value: item, colour: null };
  if (!field.multiple) {
    const first = picked[0];
    return <ChoiceBadge option={first === undefined ? undefined : optionFor(first)} style={textStyle} />;
  }
  return (
    <span className={styles['tags']} role="list" aria-label={label}>
      {picked.length === 0 ? <span className={styles['empty']}>–</span> : null}
      {picked.map((item) => (
        <span key={item} role="listitem">
          <ChoiceBadge option={optionFor(item)} style={textStyle} />
        </span>
      ))}
    </span>
  );
}

export function CheckboxField({
  field,
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
      <span>{value === true ? field.onLabel || t('cards.yes') : field.offLabel || t('cards.no')}</span>
    </label>
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
  field,
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
      {field.showProgress && items.length > 0 ? (
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
