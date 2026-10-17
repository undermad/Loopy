import type { ComponentProps } from 'react';
import * as Radix from '@radix-ui/react-popover';
import { cx } from '../cx';
import styles from './Popover.module.scss';

function Content({ className, sideOffset = 6, ...rest }: ComponentProps<typeof Radix.Content>) {
  return (
    <Radix.Portal>
      <Radix.Content className={cx(styles['content'], className)} sideOffset={sideOffset} {...rest} />
    </Radix.Portal>
  );
}

export const Popover = {
  Root: Radix.Root,
  Trigger: Radix.Trigger,
  Anchor: Radix.Anchor,
  Close: Radix.Close,
  Content,
};
