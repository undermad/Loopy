import * as RadixSeparator from '@radix-ui/react-separator';
import { cx } from '../cx';
import styles from './Separator.module.scss';

export interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  decorative?: boolean;
  className?: string;
}

export function Separator({ orientation = 'horizontal', decorative = true, className }: SeparatorProps) {
  return (
    <RadixSeparator.Root
      orientation={orientation}
      decorative={decorative}
      className={cx(styles['separator'], styles[orientation], className)}
    />
  );
}
