import type { ReactNode } from 'react';
import * as Radix from '@radix-ui/react-scroll-area';
import { cx } from '../cx';
import styles from './ScrollArea.module.scss';

export interface ScrollAreaProps {
  children: ReactNode;
  orientation?: 'vertical' | 'horizontal' | 'both';
  className?: string | undefined;
  viewportClassName?: string | undefined;
}

export function ScrollArea({
  children,
  orientation = 'vertical',
  className,
  viewportClassName,
}: ScrollAreaProps) {
  return (
    <Radix.Root className={cx(styles['root'], className)} type="auto">
      <Radix.Viewport className={cx(styles['viewport'], viewportClassName)}>{children}</Radix.Viewport>
      {orientation !== 'horizontal' ? (
        <Radix.Scrollbar orientation="vertical" className={styles['scrollbar']}>
          <Radix.Thumb className={styles['thumb']} />
        </Radix.Scrollbar>
      ) : null}
      {orientation !== 'vertical' ? (
        <Radix.Scrollbar orientation="horizontal" className={styles['scrollbar']}>
          <Radix.Thumb className={styles['thumb']} />
        </Radix.Scrollbar>
      ) : null}
      <Radix.Corner />
    </Radix.Root>
  );
}
