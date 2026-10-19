import type { FieldOf } from '@shared/cards';
import { statFraction } from '@renderer/lib/cards';
import { NumberValue, type FieldViewProps } from './inputs';
import styles from '../CardView.module.scss';

export function NumberKindField({
  value,
  editable,
  label,
  textStyle,
  onChange,
}: FieldViewProps<FieldOf<'number'>>) {
  return editable ? (
    <div style={textStyle}>
      <NumberValue value={value} label={label} onCommit={onChange} />
    </div>
  ) : (
    <div className={styles['static']} style={textStyle}>
      {typeof value === 'number' ? value : '–'}
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
        <span className={styles['statValue']}>{typeof value === 'number' ? value : 0}</span>
      )}
    </div>
  );
}
