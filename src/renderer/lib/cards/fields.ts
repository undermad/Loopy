import type { CardValue } from '@shared/board';
import { cardFieldSchema, type CardField, type CardFieldKind, type CardSpan } from '@shared/cards';

export type FieldValueKind = 'text' | 'number' | 'boolean' | 'list' | 'none';

export const FIELD_KINDS: Record<CardFieldKind, { span: CardSpan; value: FieldValueKind }> = {
  heading: { span: 12, value: 'text' },
  text: { span: 12, value: 'text' },
  longText: { span: 12, value: 'text' },
  number: { span: 6, value: 'number' },
  select: { span: 6, value: 'text' },
  checkbox: { span: 6, value: 'boolean' },
  tags: { span: 12, value: 'list' },
  image: { span: 12, value: 'text' },
  stat: { span: 12, value: 'number' },
  colour: { span: 6, value: 'text' },
  divider: { span: 12, value: 'none' },
};

const HEX = /^#[0-9a-f]{6}$/i;

function shortId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10);
}

export function newField(
  kind: CardFieldKind,
  label: string,
  existing: Pick<CardField, 'id'>[] = [],
): CardField {
  let id = shortId();
  while (existing.some((field) => field.id === id)) id = shortId();
  return cardFieldSchema.parse({
    id,
    kind,
    label,
    span: FIELD_KINDS[kind].span,
    ...(kind === 'stat' ? { min: 0, max: 100, defaultValue: 50 } : {}),
    ...(kind === 'select' ? { options: ['Option 1', 'Option 2'] } : {}),
    ...(kind === 'divider' ? { showLabel: false } : {}),
  });
}

export function coerceValue(field: CardField, raw: unknown): CardValue {
  switch (FIELD_KINDS[field.kind].value) {
    case 'none':
      return null;
    case 'boolean':
      return typeof raw === 'boolean' ? raw : null;
    case 'list':
      return Array.isArray(raw)
        ? raw
            .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
            .map((item) => item.trim().slice(0, 80))
            .slice(0, 50)
        : null;
    case 'number': {
      const value =
        typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
      if (!Number.isFinite(value)) return null;
      if (field.kind !== 'stat') return value;
      const min = field.min ?? 0;
      const max = field.max ?? 100;
      return Math.min(Math.max(value, Math.min(min, max)), Math.max(min, max));
    }
    case 'text': {
      if (typeof raw !== 'string') return null;
      if (field.kind === 'select') return field.options.includes(raw) ? raw : null;
      if (field.kind === 'colour') return HEX.test(raw) ? raw.toLowerCase() : null;
      return raw.slice(0, 5000);
    }
  }
}

export function fieldValue(field: CardField, values: Record<string, CardValue>): CardValue {
  const own = coerceValue(field, values[field.id]);
  return own ?? coerceValue(field, field.defaultValue);
}

export function statFraction(field: CardField, value: CardValue): number {
  const min = field.min ?? 0;
  const max = field.max ?? 100;
  if (typeof value !== 'number' || max === min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

export function moveField(fields: CardField[], from: number, to: number): CardField[] {
  if (from === to || from < 0 || to < 0 || from >= fields.length || to >= fields.length) return fields;
  const next = [...fields];
  const [moved] = next.splice(from, 1);
  if (moved) next.splice(to, 0, moved);
  return next;
}
