import { cardFieldSchema, type CardField, type CardFieldKind } from '@shared/cards';
import { FIELD_KINDS } from './kinds';

const MAX_ID = 64;

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_ID - 4);
}

export function uniqueFieldId(label: string, existing: Pick<CardField, 'id'>[], fallback = 'field'): string {
  const base = slug(label) || slug(fallback) || 'field';
  const taken = new Set(existing.map((field) => field.id));
  if (!taken.has(base)) return base;
  let index = 2;
  while (taken.has(`${base}_${String(index)}`)) index += 1;
  return `${base}_${String(index)}`;
}

export function newField(
  kind: CardFieldKind,
  label: string,
  existing: Pick<CardField, 'id'>[] = [],
): CardField {
  const id = uniqueFieldId(label, existing, kind);
  const definition = FIELD_KINDS[kind];
  return cardFieldSchema.parse({ id, kind, label, span: definition.span, ...definition.defaults });
}

export function changeFieldKind(field: CardField, kind: CardFieldKind): CardField {
  if (field.kind === kind) return field;
  const { id, label, showLabel, span, style } = field;
  return cardFieldSchema.parse({ id, label, showLabel, span, style, kind, ...FIELD_KINDS[kind].defaults });
}

export function moveField(fields: CardField[], from: number, to: number): CardField[] {
  if (from === to || from < 0 || to < 0 || from >= fields.length || to >= fields.length) return fields;
  const next = [...fields];
  const [moved] = next.splice(from, 1);
  if (moved) next.splice(to, 0, moved);
  return next;
}
