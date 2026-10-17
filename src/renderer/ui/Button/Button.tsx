import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../cx';
import { Spinner } from '../Spinner/Spinner';
import type { Size } from '../types';
import styles from './Button.module.scss';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles['button'], styles[variant], styles[size], className)}
      disabled={Boolean(disabled) || loading}
      aria-busy={loading ? true : undefined}
      {...rest}
    >
      {loading ? <Spinner size={size} /> : icon}
      {children}
    </button>
  );
}
