import type { ComponentProps } from 'react';
import { cx } from '../cx';
import styles from './menu.module.scss';

export function MenuShortcut({ className, ...rest }: ComponentProps<'span'>) {
  return <span className={cx(styles['shortcut'], className)} {...rest} />;
}
