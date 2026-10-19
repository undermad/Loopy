import { VISIBILITY_OPS, type CardField, type VisibilityOp } from '@shared/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { Field, Select } from '@renderer/ui';
import { DraftInput } from './inputs';

const ALWAYS = '__always';
const VALUELESS: readonly VisibilityOp[] = ['filled', 'empty'];

export function VisibilityRule({
  field,
  fields,
  onChange,
}: {
  field: CardField;
  fields: readonly CardField[];
  onChange: (next: CardField) => void;
}) {
  const { t } = useTranslation('editors');
  const rule = field.visibleWhen;
  const others = fields.filter(
    (item) => item.id !== field.id && item.kind !== 'divider' && item.kind !== 'spacer',
  );
  return (
    <>
      <Field label={t('cards.showWhen')}>
        <Select
          size="sm"
          value={rule?.field ?? ALWAYS}
          aria-label={t('cards.showWhen')}
          options={[
            { value: ALWAYS, label: t('cards.always') },
            ...others.map((item) => ({ value: item.id, label: item.label || item.id })),
          ]}
          onValueChange={(target) => {
            onChange({
              ...field,
              visibleWhen:
                target === ALWAYS
                  ? null
                  : { field: target, op: rule?.op ?? 'filled', value: rule?.value ?? '' },
            });
          }}
        />
      </Field>
      {rule ? (
        <>
          <Field label={t('cards.condition')}>
            <Select
              size="sm"
              value={rule.op}
              options={VISIBILITY_OPS.map((op) => ({ value: op, label: t(`cards.ops.${op}`) }))}
              onValueChange={(op) => {
                onChange({ ...field, visibleWhen: { ...rule, op: op as VisibilityOp } });
              }}
            />
          </Field>
          {VALUELESS.includes(rule.op) ? null : (
            <DraftInput
              label={t('cards.ruleValue')}
              value={rule.value}
              maxLength={80}
              onCommit={(value) => {
                onChange({ ...field, visibleWhen: { ...rule, value } });
              }}
            />
          )}
        </>
      ) : null}
    </>
  );
}
