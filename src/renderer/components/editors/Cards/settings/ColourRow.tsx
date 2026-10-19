import type { ColourValue } from '@shared/colours';
import { Button } from '@renderer/ui';
import { ProjectColourPicker } from '../../../ProjectColourPicker/ProjectColourPicker';
import styles from '../CardDesigner.module.scss';

export interface ColourRowProps {
  label: string;
  value: ColourValue | null | undefined;
  fallback: string;
  resetLabel: string;
  onChange: (value: ColourValue | null) => void;
}

export function ColourRow({ label, value, fallback, resetLabel, onChange }: ColourRowProps) {
  return (
    <div className={styles['colourRow']}>
      <ProjectColourPicker
        size="sm"
        value={value ?? { hex: fallback, ref: null }}
        label={label}
        onChange={onChange}
      />
      <span>{label}</span>
      {value ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onChange(null);
          }}
        >
          {resetLabel}
        </Button>
      ) : null}
    </div>
  );
}
