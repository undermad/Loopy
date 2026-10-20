import { Circle, Heart, Square, Star, type LucideIcon } from 'lucide-react';
import type { NumberRange } from '@shared/board';
import type { FieldOf } from '@shared/cards';
import { parseDice, statFraction, symbolCount } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { cx } from '@renderer/ui';
import { INTERACTIVE, NumberValue, type FieldViewProps } from './inputs';
import styles from '../CardView.module.scss';

interface Affixes {
  prefix: string;
  suffix: string;
}

export function formatNumber(value: number, field: Affixes, decimals: number | null = null): string {
  const shown = decimals === null ? String(Math.round(value * 1e6) / 1e6) : value.toFixed(decimals);
  return `${field.prefix}${shown}${field.suffix}`;
}

function PlainNumber({
  field,
  value,
  editable,
  label,
  textStyle,
  onChange,
}: FieldViewProps<FieldOf<'number'>>) {
  return editable ? (
    <div className={styles['affixed']} style={textStyle}>
      {field.prefix ? <span>{field.prefix}</span> : null}
      <NumberValue value={value} label={label} onCommit={onChange} />
      {field.suffix ? <span>{field.suffix}</span> : null}
    </div>
  ) : (
    <div className={styles['static']} style={textStyle}>
      {typeof value === 'number' ? formatNumber(value, field) : '–'}
    </div>
  );
}

function StatField({
  field,
  value,
  editable,
  label,
  colour,
  textStyle,
  onChange,
}: FieldViewProps<FieldOf<'number'>>) {
  const fraction = statFraction(field, value);
  return (
    <div className={styles['stat']} style={textStyle}>
      <div
        className={styles['bar']}
        role="meter"
        aria-label={label}
        aria-valuenow={typeof value === 'number' ? value : 0}
        aria-valuemin={field.min ?? 0}
        aria-valuemax={field.max ?? 100}
      >
        <span style={{ width: `${String(fraction * 100)}%`, background: colour ?? undefined }} />
      </div>
      {editable ? (
        <NumberValue value={value} label={label} onCommit={onChange} />
      ) : (
        <span className={styles['statValue']}>
          {formatNumber(typeof value === 'number' ? value : 0, field)}
        </span>
      )}
    </div>
  );
}

const SYMBOLS: Record<FieldOf<'number'>['symbol'], LucideIcon> = {
  star: Star,
  heart: Heart,
  circle: Circle,
  pip: Square,
};

function RatingField({
  field,
  value,
  editable,
  label,
  colour,
  textStyle,
  onChange,
}: FieldViewProps<FieldOf<'number'>>) {
  const { t } = useTranslation('editors');
  const current = typeof value === 'number' ? value : 0;
  const max = symbolCount(field);
  const Symbol = SYMBOLS[field.symbol];
  const steps = Array.from({ length: max }, (_, index) => index + 1);
  const symbol = (step: number) => (
    <Symbol
      aria-hidden="true"
      className={cx(styles['ratingSymbol'], step <= current && styles['ratingOn'])}
      fill={step <= current ? 'currentColor' : 'none'}
    />
  );
  if (!editable) {
    return (
      <span
        className={styles['rating']}
        style={{ ...textStyle, color: colour ?? textStyle.color }}
        role="img"
        aria-label={t('cards.ratingValue', { label, value: current, max })}
      >
        {steps.map((step) => (
          <span key={step}>{symbol(step)}</span>
        ))}
      </span>
    );
  }
  return (
    <span className={styles['rating']} style={{ ...textStyle, color: colour ?? textStyle.color }}>
      {steps.map((step) => (
        <button
          key={step}
          type="button"
          className={cx(INTERACTIVE, styles['ratingButton'])}
          aria-label={t('cards.ratingValue', { label, value: step, max })}
          aria-pressed={step <= current}
          onClick={() => {
            onChange(step === current ? 0 : step);
          }}
        >
          {symbol(step)}
        </button>
      ))}
    </span>
  );
}

function asRange(value: unknown): NumberRange | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { min, max } = value as Record<string, unknown>;
  return typeof min === 'number' && typeof max === 'number' ? { min, max } : null;
}

function RangeField({
  field,
  value,
  editable,
  label,
  textStyle,
  onChange,
}: FieldViewProps<FieldOf<'number'>>) {
  const { t } = useTranslation('editors');
  const range = asRange(value);
  if (!editable) {
    return (
      <div className={styles['static']} style={textStyle}>
        {range ? `${formatNumber(range.min, field)}–${formatNumber(range.max, field)}` : '–'}
      </div>
    );
  }
  const low = range?.min ?? field.min ?? 0;
  const high = range?.max ?? field.max ?? low;
  return (
    <div className={styles['affixed']} style={textStyle}>
      {field.prefix ? <span>{field.prefix}</span> : null}
      <NumberValue
        value={range?.min ?? null}
        label={t('cards.rangeFrom', { label })}
        onCommit={(next) => {
          onChange(next === null ? null : { min: next, max: high });
        }}
      />
      <span>–</span>
      <NumberValue
        value={range?.max ?? null}
        label={t('cards.rangeTo', { label })}
        onCommit={(next) => {
          onChange(next === null ? null : { min: low, max: next });
        }}
      />
      {field.suffix ? <span>{field.suffix}</span> : null}
    </div>
  );
}

export function NumberKindField(props: FieldViewProps<FieldOf<'number'>>) {
  const { field } = props;
  if (field.range) return <RangeField {...props} />;
  if (field.display === 'bar') return <StatField {...props} />;
  if (field.display === 'symbols') return <RatingField {...props} />;
  return <PlainNumber {...props} />;
}

export function AttributesField({
  field,
  value,
  editable,
  textStyle,
  onChange,
}: FieldViewProps<FieldOf<'attributes'>>) {
  const own =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, number | null>)
      : {};
  return (
    <dl className={styles['attributes']} style={textStyle}>
      {field.rows.map((row) => {
        const current = own[row.id];
        return (
          <div key={row.id} className={styles['attribute']}>
            <dt>{row.label}</dt>
            <dd>
              {editable ? (
                <NumberValue
                  value={current ?? null}
                  label={row.label}
                  onCommit={(next) => {
                    const { [row.id]: _old, ...rest } = own;
                    onChange(next === null ? rest : { ...rest, [row.id]: next });
                  }}
                />
              ) : typeof current === 'number' ? (
                current
              ) : (
                '–'
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function FormulaField({ field, result, textStyle }: FieldViewProps<FieldOf<'formula'>>) {
  const { t } = useTranslation('editors');
  if (!result || 'error' in result) {
    return (
      <div className={cx(styles['static'], styles['empty'])} style={textStyle}>
        {result?.error === 'empty' ? '–' : t('cards.formulaError')}
      </div>
    );
  }
  return (
    <div className={cx(styles['static'], styles['formula'])} style={textStyle}>
      {formatNumber(result.value, field, field.decimals)}
    </div>
  );
}

export function DiceField({
  field,
  value,
  editable,
  label,
  textStyle,
  onChange,
}: FieldViewProps<FieldOf<'dice'>>) {
  const { t } = useTranslation('editors');
  const notation = typeof value === 'string' ? value : '';
  const roll = notation ? parseDice(notation) : null;
  const odds = roll
    ? t('cards.diceOdds', { min: roll.min, max: roll.max, average: Math.round(roll.average * 10) / 10 })
    : null;
  return (
    <div className={styles['dice']} style={textStyle}>
      {editable ? (
        <input
          className={cx(INTERACTIVE, styles['input'], styles['diceInput'])}
          defaultValue={notation}
          key={notation}
          placeholder={field.placeholder || '2d6+1'}
          aria-label={label}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          onBlur={(event) => {
            const next = parseDice(event.target.value)?.notation ?? null;
            if (next !== (notation || null)) onChange(next);
          }}
        />
      ) : (
        <span className={styles['diceNotation']}>{notation || '–'}</span>
      )}
      {odds ? <span className={styles['diceOdds']}>{odds}</span> : null}
    </div>
  );
}
