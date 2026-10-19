import type { FieldOf } from '@shared/cards';
import { statFraction } from '@renderer/lib/cards';
import { NumberValue, type FieldViewProps } from './inputs';
import styles from '../CardView.module.scss';

export function formatNumber(value: number, field: { prefix: string; suffix: string }): string {
  return `${field.prefix}${String(value)}${field.suffix}`;
}

export function NumberKindField({
  field,
  value,
  editable,
  label,
  textStyle,
  onChange,
}: FieldViewProps<FieldOf<'number'>>) {
  return editable ? (
    <div className={styles['affixed']} style={textStyle}>
      {field.prefix ? <span>{field.prefix}</span> : null}
      <NumberValue value={value} label={label} onCommit={onChange} />
      {field.suffix ? <span>{field.suffix}</span> : null}
    </div>
  ) : (
    <div className={styles['static']} style={textStyle}>
      {typeof value === 'number' ? formatNumber(value, field) : '–'}
    </div>
  );
}

export function StatField({
  field,
  value,
  editable,
  label,
  colour,
  textStyle,
  onChange,
}: FieldViewProps<FieldOf<'stat'>>) {
  const fraction = statFraction(field, value);
  return (
    <div className={styles['stat']} style={textStyle}>
      <div
        className={styles['bar']}
        role="meter"
        aria-label={label}
        aria-valuenow={typeof value === 'number' ? value : 0}
        aria-valuemin={field.min ?? 0}
        aria-valuemax={field.max ?? 100}
      >
        <span style={{ width: `${String(fraction * 100)}%`, background: colour ?? undefined }} />
      </div>
      {editable ? (
        <NumberValue value={value} label={label} onCommit={onChange} />
      ) : (
        <span className={styles['statValue']}>
          {formatNumber(typeof value === 'number' ? value : 0, field)}
        </span>
      )}
    </div>
  );
}
