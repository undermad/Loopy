import type { ComponentProps } from 'react';
import * as Radix from '@radix-ui/react-toolbar';
import { cx } from '../cx';
import styles from './Toolbar.module.scss';

function Root({ className, ...rest }: ComponentProps<typeof Radix.Root>) {
  return <Radix.Root className={cx(styles['root'], className)} {...rest} />;
}

function Separator({ className, ...rest }: ComponentProps<typeof Radix.Separator>) {
  return <Radix.Separator className={cx(styles['separator'], className)} {...rest} />;
}

function Group({ className, ...rest }: ComponentProps<'div'>) {
  return <div className={cx(styles['group'], className)} {...rest} />;
}

export const Toolbar = { Root, Separator, Group, Button: Radix.Button };
