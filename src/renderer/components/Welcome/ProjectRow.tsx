import type { ReactNode } from 'react';
import { ContextMenu, cx } from '@renderer/ui';
import styles from './WelcomeScreen.module.scss';

export interface ProjectRowProps {
  name: string;
  meta: ReactNode;
  disabled?: boolean;
  onOpen: () => void;
  menu: ReactNode;
}

export function ProjectRow({ name, meta, disabled = false, onOpen, menu }: ProjectRowProps) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <li className={styles['rowItem']}>
          <button
            type="button"
            className={cx(styles['row'], disabled && styles['rowDisabled'])}
            onClick={onOpen}
            disabled={disabled}
          >
            <span className={styles['rowName']}>{name}</span>
            <span className={styles['rowMeta']}>{meta}</span>
          </button>
        </li>
      </ContextMenu.Trigger>
      <ContextMenu.Content>{menu}</ContextMenu.Content>
    </ContextMenu.Root>
  );
}
