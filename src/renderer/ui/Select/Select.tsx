import type { ReactNode } from 'react';
import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cx } from '../cx';
import { useFieldContext } from '../Field/Field';
import type { Size } from '../types';
import styles from './Select.module.scss';

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: ReactNode;
  size?: Size;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  className?: string | undefined;
}

export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  size = 'md',
  disabled,
  id,
  'aria-label': ariaLabel,
  className,
}: SelectProps) {
  const field = useFieldContext();
  return (
    <RadixSelect.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <RadixSelect.Trigger
        id={id ?? field?.id}
        aria-label={ariaLabel}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid ? true : undefined}
        className={cx(styles['trigger'], styles[size], className)}
      >
        <span className={styles['value']}>
          <RadixSelect.Value placeholder={placeholder} />
        </span>
        <RadixSelect.Icon className={styles['icon']}>
          <ChevronDown aria-hidden="true" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content position="popper" sideOffset={4} className={styles['content']}>
          <RadixSelect.Viewport className={styles['viewport']}>
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={styles['item']}
              >
                <RadixSelect.ItemIndicator className={styles['indicator']}>
                  <Check aria-hidden="true" />
                </RadixSelect.ItemIndicator>
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
