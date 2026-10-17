import type { ComponentProps } from 'react';
import { cx } from '../cx';
import { Tooltip } from '../Tooltip/Tooltip';
import type { Size } from '../types';
import styles from './IconButton.module.scss';

export interface IconButtonProps extends Omit<ComponentProps<'button'>, 'aria-label'> {
  label: string;
  size?: Size;
  variant?: 'ghost' | 'secondary';
  tooltip?: boolean;
  active?: boolean;
}

export function IconButton({
  label,
  size = 'md',
  variant = 'ghost',
  tooltip = true,
  active = false,
  className,
  type = 'button',
  children,
  ...rest
}: IconButtonProps) {
  const button = (
    <button
      type={type}
      aria-label={label}
      aria-pressed={active || undefined}
      className={cx(styles['button'], styles[variant], styles[size], className)}
      {...rest}
    >
      {children}
    </button>
  );
  if (!tooltip) return button;
  return <Tooltip content={label}>{button}</Tooltip>;
}
