import type { FieldOf } from '@shared/cards';
import { cx } from '@renderer/ui';
import { INTERACTIVE, TextInput, stop, type FieldViewProps } from './inputs';
import styles from '../CardView.module.scss';

export function TextKindField({
  field,
  value,
  editable,
  label,
  textStyle,
  onChange,
}: FieldViewProps<FieldOf<'heading' | 'text' | 'longText'>>) {
  const text = typeof value === 'string' ? value : '';
  if (!editable) {
    return (
      <div className={cx(styles['static'], !text && styles['empty'])} style={textStyle}>
        {text || field.placeholder}
      </div>
    );
  }
  return (
    <div style={textStyle}>
      <TextInput
        value={text}
        placeholder={field.placeholder}
        multiline={field.kind === 'longText'}
        label={label}
        onCommit={onChange}
      />
    </div>
  );
}

export function StaticTextField({ field, textStyle }: FieldViewProps<FieldOf<'staticText'>>) {
  return (
    <p className={cx(styles['static'], styles['staticText'])} style={textStyle}>
      {field.text}
    </p>
  );
}

export function DateField({ value, editable, label, textStyle, onChange }: FieldViewProps<FieldOf<'date'>>) {
  const date = typeof value === 'string' ? value : '';
  if (!editable) {
    return (
      <div className={cx(styles['static'], !date && styles['empty'])} style={textStyle}>
        {date ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '–'}
      </div>
    );
  }
  return (
    <input
      className={cx(INTERACTIVE, styles['input'])}
      style={textStyle}
      type="date"
      value={date}
      aria-label={label}
      onKeyDown={stop}
      onChange={(event) => {
        onChange(event.target.value || null);
      }}
    />
  );
}
