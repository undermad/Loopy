import { useRef } from 'react';
import { cx } from '@renderer/ui';
import styles from './AssetGrid.module.scss';

export interface InlineNameProps {
  value: string;
  label: string;
  className?: string | undefined;
  onDone: (name: string | null) => void;
}

export function InlineName({ value, label, className, onDone }: InlineNameProps) {
  const done = useRef(false);

  function finish(name: string | null) {
    if (done.current) return;
    done.current = true;
    const next = name?.trim() ?? '';
    onDone(name === null || next.length === 0 || next === value ? null : next);
  }

  return (
    <input
      className={cx(styles['rename'], className)}
      aria-label={label}
      defaultValue={value}
      autoFocus
      onFocus={(event) => {
        const dot = event.currentTarget.value.lastIndexOf('.');
        event.currentTarget.setSelectionRange(0, dot > 0 ? dot : event.currentTarget.value.length);
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') {
          event.preventDefault();
          finish(event.currentTarget.value);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          finish(null);
        }
      }}
      onBlur={(event) => {
        finish(event.currentTarget.value);
      }}
    />
  );
}
