import type { ComponentProps } from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';
import { cx } from '../cx';
import styles from './Tabs.module.scss';

function Root({ className, ...rest }: ComponentProps<typeof RadixTabs.Root>) {
  return <RadixTabs.Root className={cx(styles['root'], className)} {...rest} />;
}

function List({ className, ...rest }: ComponentProps<typeof RadixTabs.List>) {
  return <RadixTabs.List className={cx(styles['list'], className)} {...rest} />;
}

function Trigger({ className, ...rest }: ComponentProps<typeof RadixTabs.Trigger>) {
  return <RadixTabs.Trigger className={cx(styles['trigger'], className)} {...rest} />;
}

function Content({ className, ...rest }: ComponentProps<typeof RadixTabs.Content>) {
  return <RadixTabs.Content className={cx(styles['content'], className)} {...rest} />;
}

export const Tabs = { Root, List, Trigger, Content };
