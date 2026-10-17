import type { ComponentProps, CSSProperties } from 'react';
import { cx } from '../cx';
import type { Size } from '../types';
import styles from './Tag.module.scss';

export interface TagProps extends ComponentProps<'span'> {
  color?: string;
  size?: Size;
}

export function Tag({ color, size = 'md', className, style, children, ...rest }: TagProps) {
  const tagStyle = color ? ({ ...style, '--tag-color': color } as CSSProperties) : style;
  return (
    <span
      className={cx(styles['tag'], styles[size], color && styles['tinted'], className)}
      style={tagStyle}
      {...rest}
    >
      {color ? <span className={styles['dot']} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
