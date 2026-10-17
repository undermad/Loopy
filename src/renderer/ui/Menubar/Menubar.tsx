import type { ComponentProps } from 'react';
import * as Radix from '@radix-ui/react-menubar';
import { Check, ChevronRight, Circle } from 'lucide-react';
import { cx } from '../cx';
import { MenuShortcut } from '../Menu/MenuShortcut';
import styles from '../Menu/menu.module.scss';

function Root({ className, ...rest }: ComponentProps<typeof Radix.Root>) {
  return <Radix.Root className={cx(styles['menubar'], className)} {...rest} />;
}

function Trigger({ className, ...rest }: ComponentProps<typeof Radix.Trigger>) {
  return <Radix.Trigger className={cx(styles['menubarTrigger'], className)} {...rest} />;
}

function Content({
  className,
  sideOffset = 4,
  align = 'start',
  ...rest
}: ComponentProps<typeof Radix.Content>) {
  return (
    <Radix.Portal>
      <Radix.Content
        className={cx(styles['content'], className)}
        sideOffset={sideOffset}
        align={align}
        {...rest}
      />
    </Radix.Portal>
  );
}

function SubContent({ className, sideOffset = 2, ...rest }: ComponentProps<typeof Radix.SubContent>) {
  return (
    <Radix.Portal>
      <Radix.SubContent className={cx(styles['content'], className)} sideOffset={sideOffset} {...rest} />
    </Radix.Portal>
  );
}

function Item({ className, ...rest }: ComponentProps<typeof Radix.Item>) {
  return <Radix.Item className={cx(styles['item'], className)} {...rest} />;
}

function CheckboxItem({ className, children, ...rest }: ComponentProps<typeof Radix.CheckboxItem>) {
  return (
    <Radix.CheckboxItem className={cx(styles['item'], className)} {...rest}>
      <Radix.ItemIndicator className={styles['indicator']}>
        <Check aria-hidden="true" />
      </Radix.ItemIndicator>
      {children}
    </Radix.CheckboxItem>
  );
}

function RadioItem({ className, children, ...rest }: ComponentProps<typeof Radix.RadioItem>) {
  return (
    <Radix.RadioItem className={cx(styles['item'], className)} {...rest}>
      <Radix.ItemIndicator className={styles['indicator']}>
        <Circle aria-hidden="true" size={8} fill="currentColor" />
      </Radix.ItemIndicator>
      {children}
    </Radix.RadioItem>
  );
}

function SubTrigger({ className, children, ...rest }: ComponentProps<typeof Radix.SubTrigger>) {
  return (
    <Radix.SubTrigger className={cx(styles['subTrigger'], className)} {...rest}>
      {children}
      <ChevronRight aria-hidden="true" />
    </Radix.SubTrigger>
  );
}

function Label({ className, ...rest }: ComponentProps<typeof Radix.Label>) {
  return <Radix.Label className={cx(styles['label'], className)} {...rest} />;
}

function Separator({ className, ...rest }: ComponentProps<typeof Radix.Separator>) {
  return <Radix.Separator className={cx(styles['separator'], className)} {...rest} />;
}

export const Menubar = {
  Root,
  Menu: Radix.Menu,
  Trigger,
  Group: Radix.Group,
  RadioGroup: Radix.RadioGroup,
  Sub: Radix.Sub,
  Content,
  SubContent,
  Item,
  CheckboxItem,
  RadioItem,
  SubTrigger,
  Label,
  Separator,
  Shortcut: MenuShortcut,
};
