import { useState } from 'react';
import { Field, Input } from '@renderer/ui';

export interface NumberFieldProps {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  step?: number;
  digits?: number;
}

function format(value: number, digits: number): string {
  const rounded = Number(value.toFixed(digits));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

export function NumberField({ label, value, onCommit, min, step = 0.1, digits = 3 }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? format(value, digits);

  function commit() {
    if (draft === null) return;
    const parsed = Number(draft);
    setDraft(null);
    if (!Number.isFinite(parsed) || draft.trim() === '') return;
    const clamped = min !== undefined && parsed < min ? min : parsed;
    if (format(clamped, digits) !== format(value, digits)) onCommit(clamped);
  }

  return (
    <Field label={label}>
      <Input
        size="sm"
        type="number"
        inputMode="decimal"
        step={step}
        {...(min !== undefined ? { min } : {})}
        value={shown}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            setDraft(null);
          }
        }}
      />
    </Field>
  );
}
