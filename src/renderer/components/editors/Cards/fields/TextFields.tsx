import type { FieldOf } from '@shared/cards';
import { cx } from '@renderer/ui';
import { TextInput, type FieldViewProps } from './inputs';
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
