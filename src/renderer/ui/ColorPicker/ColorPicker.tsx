import type { CSSProperties } from 'react';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { cx } from '../cx';
import { Popover } from '../Popover/Popover';
import type { Size } from '../types';
import styles from './ColorPicker.module.scss';

export interface ColorSwatchProps {
  color: string;
  size?: Size;
  className?: string | undefined;
}

export function ColorSwatch({ color, size = 'md', className }: ColorSwatchProps) {
  return (
    <span
      className={cx(styles['swatch'], styles[size], className)}
      style={{ '--swatch-color': color } as CSSProperties}
      aria-hidden="true"
    />
  );
}

export interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  size?: Size;
  disabled?: boolean;
  className?: string | undefined;
}

export function ColorPicker({ value, onChange, label, size = 'md', disabled, className }: ColorPickerProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          className={cx(styles['trigger'], styles[size], className)}
        >
          <ColorSwatch color={value} size={size} />
        </button>
      </Popover.Trigger>
      <Popover.Content className={styles['content']} align="start">
        <HexColorPicker className={styles['picker']} color={value} onChange={onChange} />
        <HexColorInput
          color={value}
          onChange={onChange}
          prefixed
          aria-label={label}
          className={styles['input']}
        />
      </Popover.Content>
    </Popover.Root>
  );
}
