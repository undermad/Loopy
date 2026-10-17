import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './EmptyState.module.scss';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string | undefined;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cx(styles['empty'], className)}>
      {icon ? (
        <div className={styles['icon']} aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <p className={styles['title']}>{title}</p>
      {description ? <p className={styles['description']}>{description}</p> : null}
      {action ? <div className={styles['action']}>{action}</div> : null}
    </div>
  );
}
