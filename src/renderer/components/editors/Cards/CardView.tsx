import type { CSSProperties } from 'react';
import type { CardValue } from '@shared/board';
import type { CardField, CardLayout, CardTextSize } from '@shared/cards';
import { fieldValue } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { useResolvedColour } from '@renderer/lib/palettes';
import { cx } from '@renderer/ui';
import { renderFieldView } from './fields';
import styles from './CardView.module.scss';

export interface CardViewProps {
  layout: Pick<CardLayout, 'fields' | 'gap'>;
  values: Record<string, CardValue>;
  editable: boolean;
  onChange?: (fieldId: string, value: CardValue) => void;
  selectedFieldId?: string | null;
  onSelectField?: (fieldId: string) => void;
  className?: string | undefined;
}

const SIZES: Record<CardTextSize, string> = {
  xs: '0.75em',
  sm: '0.875em',
  md: '1em',
  lg: '1.25em',
  xl: '1.6em',
};

const WEIGHTS = { normal: 400, medium: 500, bold: 700 } as const;

interface FieldBodyProps {
  field: CardField;
  value: CardValue;
  editable: boolean;
  label: string;
  onChange: (value: CardValue) => void;
}

function FieldBody({ field, value, editable, label, onChange }: FieldBodyProps) {
  const colour = useResolvedColour(field.style.colour ?? null);
  const heading = field.kind === 'heading';
  const textStyle: CSSProperties = {
    fontSize: field.style.size ? SIZES[field.style.size] : heading ? SIZES.lg : undefined,
    fontWeight: field.style.weight ? WEIGHTS[field.style.weight] : heading ? 700 : undefined,
    color: colour ?? undefined,
    textAlign: field.style.align,
  };
  return renderFieldView({ field, value, editable, label, colour, textStyle, onChange });
}

export function CardView({
  layout,
  values,
  editable,
  onChange,
  selectedFieldId,
  onSelectField,
  className,
}: CardViewProps) {
  const { t } = useTranslation('editors');
  return (
    <div className={cx(styles['card'], className)} style={{ gap: layout.gap }}>
      {layout.fields.map((field) => {
        const label = field.label || t(`cards.kinds.${field.kind}`);
        return (
          <div
            key={field.id}
            className={cx(
              styles['field'],
              selectedFieldId === field.id && styles['fieldSelected'],
              onSelectField && styles['fieldPickable'],
            )}
            style={{ gridColumn: `span ${String(field.span)}` }}
            data-kind={field.kind}
            data-field-id={field.id}
            onClick={
              onSelectField
                ? () => {
                    onSelectField(field.id);
                  }
                : undefined
            }
          >
            {field.showLabel && field.kind !== 'divider' ? (
              <span className={styles['label']}>{label}</span>
            ) : null}
            <FieldBody
              field={field}
              value={fieldValue(field, values)}
              editable={editable}
              label={label}
              onChange={(value) => onChange?.(field.id, value)}
            />
          </div>
        );
      })}
    </div>
  );
}
