import { cardFieldSchema, type CardField, type CardFieldKind } from '@shared/cards';
import { FIELD_KINDS, findPreset, type FieldPresetId } from './kinds';

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

function presetFor(source: FieldPresetId | CardFieldKind) {
  return findPreset(source === 'separator' ? FIELD_KINDS.separator.preset : source);
}

export function newField(
  source: FieldPresetId | CardFieldKind,
  label: string,
  existing: Pick<CardField, 'id'>[] = [],
): CardField {
  const preset = presetFor(source);
  const id = uniqueFieldId(label, existing, preset.id);
  return cardFieldSchema.parse({ id, kind: preset.kind, label, span: preset.span, ...preset.defaults });
}

export function changeFieldKind(field: CardField, kind: CardFieldKind): CardField {
  if (field.kind === kind) return field;
  const { kind: _old, ...shared } = field;
  const candidate: Record<string, unknown> = { ...presetFor(kind).defaults, ...shared, kind };
  for (;;) {
    const parsed = cardFieldSchema.safeParse(candidate);
    if (parsed.success) return parsed.data;
    const keys = new Set(parsed.error.issues.map((issue) => issue.path[0]));
    const clashing = [...keys].filter((key): key is string => typeof key === 'string' && key in shared);
    if (clashing.length === 0) throw parsed.error;
    for (const key of clashing) Reflect.deleteProperty(candidate, key);
  }
}

export function moveField(fields: CardField[], from: number, to: number): CardField[] {
  if (from === to || from < 0 || to < 0 || from >= fields.length || to >= fields.length) return fields;
  const next = [...fields];
  const [moved] = next.splice(from, 1);
  if (moved) next.splice(to, 0, moved);
  return next;
}
