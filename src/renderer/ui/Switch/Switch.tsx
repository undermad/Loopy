import { useId, type ReactNode } from 'react';
import * as RadixSwitch from '@radix-ui/react-switch';
import { cx } from '../cx';
import type { Size } from '../types';
import styles from './Switch.module.scss';

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: ReactNode;
  'aria-label'?: string;
  size?: Size;
  disabled?: boolean;
  id?: string;
  className?: string | undefined;
}

export function Switch({
  checked,
  defaultChecked,
  onCheckedChange,
  label,
  'aria-label': ariaLabel,
  size = 'md',
  disabled,
  id,
  className,
}: SwitchProps) {
  const generatedId = useId();
  const switchId = id ?? generatedId;
  const control = (
    <RadixSwitch.Root
      id={switchId}
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cx(styles['root'], styles[size], label ? undefined : className)}
    >
      <RadixSwitch.Thumb className={styles['thumb']} />
    </RadixSwitch.Root>
  );
  if (!label) return control;
  return (
    <label htmlFor={switchId} className={cx(styles['label'], className)}>
      {control}
      <span>{label}</span>
    </label>
  );
}
