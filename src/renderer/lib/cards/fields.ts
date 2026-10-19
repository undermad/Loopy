import { boardLinkSchema, type BoardLink, type CardValue } from '@shared/board';
import { cardFieldSchema, type CardField, type CardFieldKind, type FieldOf } from '@shared/cards';
import { FIELD_KINDS } from './kinds';

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
  const definition = FIELD_KINDS[kind];
  return cardFieldSchema.parse({ id, kind, label, span: definition.span, ...definition.defaults });
}

export function changeFieldKind(field: CardField, kind: CardFieldKind): CardField {
  if (field.kind === kind) return field;
  const { id, label, showLabel, span, style } = field;
  return cardFieldSchema.parse({ id, label, showLabel, span, style, kind, ...FIELD_KINDS[kind].defaults });
}

export function linkTargets(raw: unknown): BoardLink[] {
  const items = Array.isArray(raw) ? (raw as unknown[]) : [raw];
  const links: BoardLink[] = [];
  for (const item of items) {
    const parsed = boardLinkSchema.safeParse(item);
    if (parsed.success) links.push(parsed.data);
  }
  return links;
}

function coerceLinks(field: FieldOf<'link'>, raw: unknown): CardValue {
  const allowed = linkTargets(raw).filter(
    (link) => field.linkKinds.length === 0 || field.linkKinds.includes(link.kind),
  );
  const unique = [...new Map(allowed.map((link) => [`${link.kind}:${link.id}`, link])).values()];
  if (unique.length === 0) return null;
  return field.multiple ? unique.slice(0, 50) : (unique[0] ?? null);
}

function bounds(field: CardField): { min: number; max: number } {
  return 'min' in field ? { min: field.min ?? 0, max: field.max ?? 100 } : { min: 0, max: 100 };
}

function coerceNumber(field: CardField, raw: unknown): number | null {
  const value =
    typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  if (!Number.isFinite(value)) return null;
  if (field.kind !== 'stat') return value;
  const { min, max } = bounds(field);
  return Math.min(Math.max(value, Math.min(min, max)), Math.max(min, max));
}

function coerceText(field: CardField, raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  if (field.kind === 'select') return field.options.includes(raw) ? raw : null;
  if (field.kind === 'colour') return HEX.test(raw) ? raw.toLowerCase() : null;
  return raw.slice(0, 5000);
}

function coerceList(raw: unknown): string[] | null {
  return Array.isArray(raw)
    ? raw
        .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
        .map((item) => item.trim().slice(0, 80))
        .slice(0, 50)
    : null;
}

export function coerceValue(field: CardField, raw: unknown): CardValue {
  if (field.kind === 'link') return coerceLinks(field, raw);
  switch (FIELD_KINDS[field.kind].value) {
    case 'none':
    case 'link':
      return null;
    case 'boolean':
      return typeof raw === 'boolean' ? raw : null;
    case 'list':
      return coerceList(raw);
    case 'number':
      return coerceNumber(field, raw);
    case 'text':
      return coerceText(field, raw);
  }
}

export function valueText(value: CardValue): string {
  if (value === null) return '';
  if (typeof value !== 'object') return String(value);
  if (!Array.isArray(value)) return '';
  return value.filter((item): item is string => typeof item === 'string').join(', ');
}

export function defaultOf(field: CardField): CardValue {
  return 'defaultValue' in field ? field.defaultValue : null;
}

export function fieldValue(field: CardField, values: Record<string, CardValue>): CardValue {
  const own = coerceValue(field, values[field.id]);
  return own ?? coerceValue(field, defaultOf(field));
}

export function statFraction(field: CardField, value: CardValue): number {
  const { min, max } = bounds(field);
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
