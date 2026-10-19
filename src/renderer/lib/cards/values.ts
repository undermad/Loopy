import { boardLinkSchema, type BoardLink, type CardValue, type ChecklistItem } from '@shared/board';
import type { CardField, CardFieldKind, FieldOf } from '@shared/cards';
import { parseDice } from './dice';

const HEX = /^#[0-9a-f]{6}$/i;
const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function linkTargets(raw: unknown): BoardLink[] {
  const items = Array.isArray(raw) ? (raw as unknown[]) : [raw];
  const links: BoardLink[] = [];
  for (const item of items) {
    const parsed = boardLinkSchema.safeParse(item);
    if (parsed.success) links.push(parsed.data);
  }
  return links;
}

function toNumber(raw: unknown): number | null {
  const value =
    typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : null;
}

function clampTo(value: number, low: number | null, high: number | null): number {
  const min = low ?? -Infinity;
  const max = high ?? Infinity;
  return Math.min(Math.max(value, Math.min(min, max)), Math.max(min, max));
}

function text(raw: unknown): string | null {
  return typeof raw === 'string' ? raw.slice(0, 5000) : null;
}

function list(raw: unknown): string[] | null {
  return Array.isArray(raw)
    ? raw
        .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
        .map((item) => item.trim().slice(0, 80))
        .slice(0, 50)
    : null;
}

function none(): null {
  return null;
}

function optionValues(field: FieldOf<'select' | 'multiSelect'>): string[] {
  return field.options.map((option) => option.value);
}

function links(field: FieldOf<'link'>, raw: unknown): CardValue {
  const allowed = linkTargets(raw).filter(
    (link) => field.linkKinds.length === 0 || field.linkKinds.includes(link.kind),
  );
  const unique = [...new Map(allowed.map((link) => [`${link.kind}:${link.id}`, link])).values()];
  if (unique.length === 0) return null;
  return field.multiple ? unique.slice(0, 50) : (unique[0] ?? null);
}

function checklist(raw: unknown): ChecklistItem[] | null {
  if (!Array.isArray(raw)) return null;
  const items: ChecklistItem[] = [];
  for (const item of raw as unknown[]) {
    if (typeof item !== 'object' || item === null) continue;
    const { text: label, done } = item as Record<string, unknown>;
    if (typeof label !== 'string' || label.trim() === '') continue;
    items.push({ text: label.trim().slice(0, 200), done: done === true });
  }
  return items.slice(0, 50);
}

type ValueRules = { [K in CardFieldKind]: (field: FieldOf<K>, raw: unknown) => CardValue };

const VALUE_RULES: ValueRules = {
  heading: (_field, raw) => text(raw),
  text: (_field, raw) => text(raw),
  longText: (_field, raw) => text(raw),
  staticText: none,
  date: (_field, raw) => (typeof raw === 'string' && ISO_DATE.test(raw) ? raw : null),
  number: (field, raw) => {
    const value = toNumber(raw);
    return value === null ? null : clampTo(value, field.min, field.max);
  },
  stat: (field, raw) => {
    const value = toNumber(raw);
    return value === null ? null : clampTo(value, field.min ?? 0, field.max ?? 100);
  },
  rating: (field, raw) => {
    const value = toNumber(raw);
    return value === null ? null : clampTo(Math.round(value), 0, field.max);
  },
  range: (field, raw) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
    const low = toNumber((raw as Record<string, unknown>)['min']);
    const high = toNumber((raw as Record<string, unknown>)['max']);
    if (low === null || high === null) return null;
    return {
      min: clampTo(Math.min(low, high), field.min, field.max),
      max: clampTo(Math.max(low, high), field.min, field.max),
    };
  },
  attributes: (field, raw) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
    const entries = field.rows.flatMap((row) => {
      const value = (raw as Record<string, unknown>)[row.id];
      return typeof value === 'number' && Number.isFinite(value) ? [[row.id, value] as const] : [];
    });
    return entries.length > 0 ? Object.fromEntries(entries) : null;
  },
  formula: none,
  dice: (_field, raw) => (typeof raw === 'string' ? (parseDice(raw)?.notation ?? null) : null),
  select: (field, raw) => (typeof raw === 'string' && optionValues(field).includes(raw) ? raw : null),
  multiSelect: (field, raw) => {
    const known = optionValues(field);
    const picked = [...new Set(list(raw) ?? [])].filter((item) => known.includes(item));
    return picked.length > 0 ? picked : null;
  },
  checkbox: (_field, raw) => (typeof raw === 'boolean' ? raw : null),
  tags: (_field, raw) => list(raw),
  checklist: (_field, raw) => checklist(raw),
  image: (_field, raw) => text(raw),
  icon: (_field, raw) => (typeof raw === 'string' && raw !== '' && raw.length <= 40 ? raw : null),
  colour: (_field, raw) => (typeof raw === 'string' && HEX.test(raw) ? raw.toLowerCase() : null),
  link: links,
  divider: none,
  spacer: none,
};

export function coerceValue(field: CardField, raw: unknown): CardValue {
  const rule = VALUE_RULES[field.kind] as (field: CardField, raw: unknown) => CardValue;
  return rule(field, raw);
}

export function valueText(value: CardValue): string {
  if (value === null) return '';
  if (typeof value !== 'object') return String(value);
  if (!Array.isArray(value)) return '';
  return value
    .map((item) => (typeof item === 'string' ? item : 'text' in item ? item.text : ''))
    .filter(Boolean)
    .join(', ');
}

function defaultOf(field: CardField): CardValue {
  return 'defaultValue' in field ? field.defaultValue : null;
}

export function fieldValue(field: CardField, values: Readonly<Record<string, CardValue>>): CardValue {
  const own = coerceValue(field, values[field.id]);
  return own ?? coerceValue(field, defaultOf(field));
}

export function statFraction(field: CardField, value: CardValue): number {
  const min = 'min' in field ? (field.min ?? 0) : 0;
  const max = 'max' in field ? (field.max ?? 100) : 100;
  if (typeof value !== 'number' || max === min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}
