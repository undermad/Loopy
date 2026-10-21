import { useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { CardValue } from '@shared/board';
import type { CardField } from '@shared/cards';
import type { FormulaResult } from '@renderer/lib/cards';
import { NumberInput, cx } from '@renderer/ui';
import styles from '../CardView.module.scss';

export const INTERACTIVE = 'nodrag nowheel nopan';

export function stop(event: KeyboardEvent) {
  event.stopPropagation();
}

export interface FieldViewProps<F extends CardField = CardField> {
  field: F;
  value: CardValue;
  editable: boolean;
  label: string;
  colour: string | null;
  textStyle: CSSProperties;
  result?: FormulaResult | undefined;
  onChange: (value: CardValue) => void;
}

interface TextInputProps {
  value: string;
  placeholder: string;
  multiline: boolean;
  label: string;
  maxLength?: number | null;
  onCommit: (next: string) => void;
}

export function TextInput({ value, placeholder, multiline, label, maxLength, onCommit }: TextInputProps) {
  const limit = maxLength === null || maxLength === undefined ? {} : { maxLength };
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };
  if (multiline) {
    return (
      <textarea
        className={cx(INTERACTIVE, styles['input'], styles['area'])}
        value={shown}
        placeholder={placeholder}
        aria-label={label}
        {...limit}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={stop}
      />
    );
  }
  return (
    <input
      className={cx(INTERACTIVE, styles['input'])}
      value={shown}
      placeholder={placeholder}
      aria-label={label}
      {...limit}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}

interface NumberValueProps {
  value: CardValue;
  label: string;
  onCommit: (next: number | null) => void;
}

export function NumberValue({ value, label, onCommit }: NumberValueProps) {
  return (
    <NumberInput
      className={cx(INTERACTIVE, styles['input'], styles['number'])}
      size="sm"
      value={typeof value === 'number' ? value : null}
      nullable
      aria-label={label}
      onValueChange={onCommit}
      onKeyDown={(event) => {
        event.stopPropagation();
      }}
    />
  );
}
