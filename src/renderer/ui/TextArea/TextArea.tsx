import type { ComponentProps } from 'react';
import { cx } from '../cx';
import { useFieldContext } from '../Field/Field';
import styles from './TextArea.module.scss';

export interface TextAreaProps extends ComponentProps<'textarea'> {
  invalid?: boolean;
}

export function TextArea({
  invalid,
  className,
  id,
  rows = 3,
  'aria-describedby': describedBy,
  ...rest
}: TextAreaProps) {
  const field = useFieldContext();
  return (
    <textarea
      id={id ?? field?.id}
      rows={rows}
      aria-describedby={describedBy ?? field?.describedBy}
      aria-invalid={(invalid ?? field?.invalid) ? true : undefined}
      className={cx(styles['textarea'], className)}
      {...rest}
    />
  );
}
