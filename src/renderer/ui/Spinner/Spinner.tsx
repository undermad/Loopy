import { cx } from '../cx';
import type { Size } from '../types';
import styles from './Spinner.module.scss';

export interface SpinnerProps {
  size?: Size;
  label?: string;
  className?: string;
}

export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx(styles['spinner'], styles[size], className)}
    />
  );
}
