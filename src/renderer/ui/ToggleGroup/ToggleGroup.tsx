import type { ReactNode } from 'react';
import * as Radix from '@radix-ui/react-toggle-group';
import { cx } from '../cx';
import type { Size } from '../types';
import styles from './ToggleGroup.module.scss';

export interface ToggleGroupItem {
  value: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface ToggleGroupProps {
  items: ToggleGroupItem[];
  value: string;
  onValueChange: (value: string) => void;
  'aria-label': string;
  size?: Size;
  iconsOnly?: boolean;
  className?: string;
}

export function ToggleGroup({
  items,
  value,
  onValueChange,
  'aria-label': ariaLabel,
  size = 'md',
  iconsOnly = false,
  className,
}: ToggleGroupProps) {
  return (
    <Radix.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next);
      }}
      aria-label={ariaLabel}
      className={cx(styles['root'], styles[size], className)}
    >
      {items.map((item) => (
        <Radix.Item
          key={item.value}
          value={item.value}
          disabled={item.disabled}
          aria-label={iconsOnly ? item.label : undefined}
          title={iconsOnly ? item.label : undefined}
          className={styles['item']}
        >
          {item.icon}
          {iconsOnly ? null : <span>{item.label}</span>}
        </Radix.Item>
      ))}
    </Radix.Root>
  );
}
