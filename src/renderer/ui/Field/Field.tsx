import { createContext, useContext, useId, type ReactNode } from 'react';
import * as Label from '@radix-ui/react-label';
import { cx } from '../cx';
import styles from './Field.module.scss';

export interface FieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export function useFieldContext(): FieldContextValue | null {
  return useContext(FieldContext);
}

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string | undefined;
}

export function Field({ label, hint, error, required = false, children, className }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cx(styles['field'], className)}>
      <Label.Root htmlFor={id} className={styles['label']}>
        {label}
        {required ? (
          <span aria-hidden="true" className={styles['required']}>
            *
          </span>
        ) : null}
      </Label.Root>
      <FieldContext value={{ id, describedBy, invalid: Boolean(error) }}>{children}</FieldContext>
      {hint ? (
        <p id={hintId} className={styles['hint']}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className={styles['error']}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
