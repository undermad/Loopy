import type { ComponentProps, ReactNode } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cx } from '../cx';
import { IconButton } from '../IconButton/IconButton';
import styles from './Dialog.module.scss';

export interface DialogContentProps {
  title: ReactNode;
  description?: ReactNode;
  closeLabel: string;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  className?: string;
}

function Content({ title, description, closeLabel, size = 'md', children, className }: DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className={styles['overlay']} />
      <RadixDialog.Content
        className={cx(styles['content'], styles[size], className)}
        {...(description ? {} : { 'aria-describedby': undefined })}
      >
        <header className={styles['header']}>
          <RadixDialog.Title className={styles['title']}>{title}</RadixDialog.Title>
          <RadixDialog.Close asChild>
            <IconButton label={closeLabel} size="sm" tooltip={false}>
              <X aria-hidden="true" />
            </IconButton>
          </RadixDialog.Close>
        </header>
        {description ? (
          <RadixDialog.Description className={styles['description']}>{description}</RadixDialog.Description>
        ) : null}
        <div className={styles['body']}>{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

function Footer({ className, ...rest }: ComponentProps<'footer'>) {
  return <footer className={cx(styles['footer'], className)} {...rest} />;
}

export const Dialog = {
  Root: RadixDialog.Root,
  Trigger: RadixDialog.Trigger,
  Close: RadixDialog.Close,
  Content,
  Footer,
};
