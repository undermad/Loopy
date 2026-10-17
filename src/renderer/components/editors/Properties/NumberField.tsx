import { Field, NumberInput } from '@renderer/ui';

export interface NumberFieldProps {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  digits?: number;
  disabled?: boolean;
}

export function NumberField({
  label,
  value,
  onCommit,
  min,
  max,
  step = 0.1,
  digits = 3,
  disabled = false,
}: NumberFieldProps) {
  return (
    <Field label={label}>
      <NumberInput
        size="sm"
        value={value}
        min={min}
        max={max}
        step={step}
        digits={digits}
        disabled={disabled}
        onValueChange={(next) => {
          if (next !== null) onCommit(next);
        }}
      />
    </Field>
  );
}
