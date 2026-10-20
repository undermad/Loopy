import type { CSSProperties } from 'react';
import { Info } from 'lucide-react';
import type { CardValue } from '@shared/board';
import { CARD_ZONES, type CardField, type CardLayout, type CardTextSize } from '@shared/cards';
import {
  computeFormulas,
  fieldValue,
  isFieldVisible,
  presetOf,
  type FormulaResult,
} from '@renderer/lib/cards';
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
  showHidden?: boolean;
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
  result: FormulaResult | undefined;
  editable: boolean;
  label: string;
  onChange: (value: CardValue) => void;
}

function FieldBody({ field, value, result, editable, label, onChange }: FieldBodyProps) {
  const colour = useResolvedColour(field.style.colour ?? null);
  const textStyle: CSSProperties = {
    fontSize: field.style.size ? SIZES[field.style.size] : undefined,
    fontWeight: field.style.weight ? WEIGHTS[field.style.weight] : undefined,
    color: colour ?? undefined,
    textAlign: field.style.align,
  };
  return renderFieldView({ field, value, result, editable, label, colour, textStyle, onChange });
}

export function CardView({
  layout,
  values,
  editable,
  onChange,
  selectedFieldId,
  onSelectField,
  showHidden = false,
  className,
}: CardViewProps) {
  const { t } = useTranslation('editors');
  const formulas = computeFormulas(layout.fields, values);
  const shown = layout.fields
    .map((field) => ({ field, visible: !field.hidden && isFieldVisible(field, layout.fields, values) }))
    .filter(({ visible }) => showHidden || visible);
  const renderField = ({ field, visible }: { field: CardField; visible: boolean }) => {
    const label = field.label || t(`cards.presets.${presetOf(field)}`);
    return (
      <div
        key={field.id}
        className={cx(
          styles['field'],
          selectedFieldId === field.id && styles['fieldSelected'],
          onSelectField && styles['fieldPickable'],
          !visible && styles['fieldHidden'],
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
        {field.showLabel && field.kind !== 'separator' ? (
          <span className={styles['label']}>
            {label}
            {field.help ? (
              <span className={styles['help']} role="img" aria-label={field.help} title={field.help}>
                <Info aria-hidden="true" />
              </span>
            ) : null}
          </span>
        ) : null}
        <FieldBody
          field={field}
          value={fieldValue(field, values)}
          result={formulas[field.id]}
          editable={editable}
          label={label}
          onChange={(value) => onChange?.(field.id, value)}
        />
      </div>
    );
  };
  return (
    <div className={cx(styles['card'], className)}>
      {CARD_ZONES.map((zone) => {
        const inZone = shown.filter(({ field }) => field.zone === zone);
        if (inZone.length === 0 && zone !== 'body') return null;
        return (
          <div
            key={zone}
            className={cx(styles['zone'], styles[zone])}
            style={{ gap: layout.gap }}
            data-zone={zone}
          >
            {inZone.map(renderField)}
          </div>
        );
      })}
    </div>
  );
}
