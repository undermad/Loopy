import type { ComponentProps } from 'react';
import { cx } from '../cx';
import { useFieldContext } from '../Field/Field';
import type { Size } from '../types';
import styles from './Input.module.scss';

export interface InputProps extends Omit<ComponentProps<'input'>, 'size'> {
  size?: Size;
  invalid?: boolean;
}

export function Input({
  size = 'md',
  invalid,
  className,
  id,
  'aria-describedby': describedBy,
  ...rest
}: InputProps) {
  const field = useFieldContext();
  return (
    <input
      id={id ?? field?.id}
      aria-describedby={describedBy ?? field?.describedBy}
      aria-invalid={(invalid ?? field?.invalid) ? true : undefined}
      className={cx(styles['input'], styles[size], className)}
      {...rest}
    />
  );
}
