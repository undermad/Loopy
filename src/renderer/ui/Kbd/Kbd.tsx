import type { ComponentProps } from 'react';
import { cx } from '../cx';
import styles from './Kbd.module.scss';

export function Kbd({ className, ...rest }: ComponentProps<'kbd'>) {
  return <kbd className={cx(styles['kbd'], className)} {...rest} />;
}
