import type { CardValue } from '@shared/board';
import type { CardField, CardLayout } from '@shared/cards';
import type { ColourValue } from '@shared/colours';
import { evaluateFormula, formulaNames, type FormulaResult } from './expressions';
import { fieldValue, valueText } from './values';

function numberOf(field: CardField, values: Readonly<Record<string, CardValue>>): number | null {
  const value = fieldValue(field, values);
  if (typeof value === 'number') return value;
  if (field.kind === 'checkbox') return value === true ? 1 : 0;
  if (field.kind === 'number' && !field.range) return 0;
  return null;
}

export function computeFormulas(
  fields: readonly CardField[],
  values: Readonly<Record<string, CardValue>>,
): Record<string, FormulaResult> {
  const scope: Record<string, number> = {};
  for (const field of fields) {
    const number = numberOf(field, values);
    if (number !== null) scope[field.id] = number;
  }
  const formulas = new Map(
    fields.flatMap((field) => (field.kind === 'formula' ? [[field.id, field.expression] as const] : [])),
  );
  const results: Record<string, FormulaResult> = {};
  const visiting = new Set<string>();

  const solve = (id: string, expression: string): FormulaResult => {
    const known = results[id];
    if (known) return known;
    if (visiting.has(id)) return { error: 'cycle' };
    visiting.add(id);
    let result: FormulaResult | null = null;
    for (const name of formulaNames(expression)) {
      const dependency = formulas.get(name);
      if (dependency === undefined || name in scope) continue;
      const solved = solve(name, dependency);
      if ('error' in solved) {
        result = solved.error === 'cycle' ? solved : { error: 'unknown', name };
        break;
      }
      scope[name] = solved.value;
    }
    visiting.delete(id);
    results[id] = result ?? evaluateFormula(expression, scope);
    if ('value' in results[id]) scope[id] = results[id].value;
    return results[id];
  };

  for (const [id, expression] of formulas) solve(id, expression);
  return results;
}

function isEmpty(value: CardValue): boolean {
  if (value === null || value === '' || value === false) return true;
  if (Array.isArray(value)) return value.length === 0;
  return typeof value === 'object' && Object.keys(value).length === 0;
}

function matches(value: CardValue, expected: string): boolean {
  const wanted = expected.trim().toLowerCase();
  if (Array.isArray(value)) {
    return value.some((item) => typeof item === 'string' && item.trim().toLowerCase() === wanted);
  }
  return valueText(value).trim().toLowerCase() === wanted;
}

export function isFieldVisible(
  field: CardField,
  fields: readonly CardField[],
  values: Readonly<Record<string, CardValue>>,
): boolean {
  const rule = field.visibleWhen;
  if (!rule) return true;
  const target = fields.find((item) => item.id === rule.field);
  if (!target || target.id === field.id) return true;
  const formula = target.kind === 'formula' ? computeFormulas(fields, values)[target.id] : undefined;
  const value = formula ? ('value' in formula ? formula.value : null) : fieldValue(target, values);
  const limit = Number(rule.value);
  switch (rule.op) {
    case 'filled':
      return !isEmpty(value);
    case 'empty':
      return isEmpty(value);
    case 'equals':
      return matches(value, rule.value);
    case 'notEquals':
      return !matches(value, rule.value);
    case 'above':
      return typeof value === 'number' && Number.isFinite(limit) && value > limit;
    case 'below':
      return typeof value === 'number' && Number.isFinite(limit) && value < limit;
  }
}

export function cardAccent(
  layout: Pick<CardLayout, 'accent' | 'accentField' | 'fields'>,
  values: Readonly<Record<string, CardValue>>,
): ColourValue | null {
  const source = layout.fields.find((field) => field.id === layout.accentField);
  if (source?.kind !== 'choice') return layout.accent;
  const value = fieldValue(source, values);
  const chosen = Array.isArray(value) ? value[0] : value;
  return source.options.find((option) => option.value === chosen)?.colour ?? layout.accent;
}
