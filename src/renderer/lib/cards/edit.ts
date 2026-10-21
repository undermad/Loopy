import { cardFieldSchema, type CardField } from '@shared/cards';
import { newField, uniqueFieldId } from './fields';
import type { FieldPresetId } from './kinds';

let clipboard: CardField[] | null = null;

export function nextCopyLabel(label: string): string {
  if (!label) return label;
  const match = /^(.*\S)\s+(\d+)$/.exec(label);
  return match ? `${match[1] ?? ''} ${String(Number(match[2]) + 1)}` : `${label} 2`;
}

function renameInFormula(expression: string, from: string, to: string): string {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return expression.replace(new RegExp(`(?<![\\w.])${escaped}(?!\\w)`, 'g'), to);
}

function renameReferences(field: CardField, renames: ReadonlyMap<string, string>): CardField {
  let next = field;
  if (next.kind === 'formula') {
    let expression = next.expression;
    for (const [from, to] of renames) expression = renameInFormula(expression, from, to);
    next = { ...next, expression };
  }
  const target = next.visibleWhen ? renames.get(next.visibleWhen.field) : undefined;
  if (next.visibleWhen && target) next = { ...next, visibleWhen: { ...next.visibleWhen, field: target } };
  return next;
}

export function duplicateFields(
  fields: CardField[],
  ids: readonly string[],
): { fields: CardField[]; ids: string[] } {
  const next: CardField[] = [];
  const added: string[] = [];
  for (const field of fields) {
    next.push(field);
    if (!ids.includes(field.id)) continue;
    const label = nextCopyLabel(field.label);
    const copy = {
      ...structuredClone(field),
      label,
      id: uniqueFieldId(label, [...fields, ...next], field.id),
    };
    next.push(copy);
    added.push(copy.id);
  }
  return { fields: next, ids: added };
}

export function removeFields(fields: CardField[], ids: readonly string[]): CardField[] {
  return fields.filter((field) => !ids.includes(field.id));
}

export function copyFieldsToClipboard(fields: readonly CardField[], ids: readonly string[]): void {
  const picked = fields.filter((field) => ids.includes(field.id));
  if (picked.length > 0) clipboard = structuredClone(picked);
}

export function fieldClipboard(): CardField[] | null {
  return clipboard;
}

export function pasteFields(
  fields: CardField[],
  pasted: readonly CardField[],
  afterId: string | null,
): { fields: CardField[]; ids: string[] } {
  const after = afterId === null ? undefined : fields.find((field) => field.id === afterId);
  const taken: Pick<CardField, 'id'>[] = [...fields];
  const renames = new Map<string, string>();
  for (const field of pasted) {
    const id = uniqueFieldId(field.label || field.id, taken, field.id);
    taken.push({ id });
    renames.set(field.id, id);
  }
  const copies = pasted.map((field) =>
    renameReferences(
      {
        ...structuredClone(field),
        id: renames.get(field.id) ?? field.id,
        ...(after ? { zone: after.zone } : {}),
      },
      renames,
    ),
  );
  const at = after ? fields.indexOf(after) + 1 : fields.length;
  return {
    fields: [...fields.slice(0, at), ...copies, ...fields.slice(at)],
    ids: copies.map((field) => field.id),
  };
}

export function moveFieldBy(fields: CardField[], id: string, delta: -1 | 1): CardField[] {
  const field = fields.find((item) => item.id === id);
  if (!field) return fields;
  const siblings = fields.filter((item) => item.zone === field.zone);
  const neighbour = siblings[siblings.indexOf(field) + delta];
  if (!neighbour) return fields;
  const from = fields.indexOf(field);
  const to = fields.indexOf(neighbour);
  const next = [...fields];
  next[from] = neighbour;
  next[to] = field;
  return next;
}

export function renameFieldId(
  layout: { fields: CardField[]; accentField: string | null },
  oldId: string,
  wanted: string,
): { fields: CardField[]; accentField: string | null; id: string } {
  const others = layout.fields.filter((field) => field.id !== oldId);
  const id = wanted.trim() ? uniqueFieldId(wanted, others, oldId) : oldId;
  if (id === oldId) return { ...layout, id };
  const renames = new Map([[oldId, id]]);
  return {
    id,
    accentField: layout.accentField === oldId ? id : layout.accentField,
    fields: layout.fields.map((field) =>
      renameReferences(field.id === oldId ? { ...field, id } : field, renames),
    ),
  };
}

export function fieldsFromLines(
  text: string,
  preset: FieldPresetId,
  existing: readonly CardField[],
): CardField[] {
  const added: CardField[] = [];
  for (const line of text.split('\n')) {
    const label = line.trim().slice(0, 80);
    if (label) added.push(newField(preset, label, [...existing, ...added]));
  }
  return added;
}

interface BlockPart {
  preset: FieldPresetId;
  label: string;
  span: number;
  extra?: Record<string, unknown>;
}

export interface FieldBlock {
  id: 'stats' | 'title' | 'badge';
  parts: BlockPart[];
}

export const FIELD_BLOCKS: readonly FieldBlock[] = [
  {
    id: 'stats',
    parts: [
      { preset: 'number', label: 'Attack', span: 4 },
      { preset: 'number', label: 'Defence', span: 4 },
      { preset: 'number', label: 'Speed', span: 4 },
    ],
  },
  {
    id: 'title',
    parts: [
      { preset: 'heading', label: 'Title', span: 12 },
      { preset: 'text', label: 'Subtitle', span: 12, extra: { showLabel: false, style: { size: 'sm' } } },
    ],
  },
  {
    id: 'badge',
    parts: [
      { preset: 'icon', label: 'Icon', span: 2, extra: { showLabel: false } },
      { preset: 'heading', label: 'Name', span: 7 },
      { preset: 'number', label: 'Cost', span: 3 },
    ],
  },
];

export function newBlock(id: FieldBlock['id'], existing: readonly CardField[]): CardField[] {
  const block = FIELD_BLOCKS.find((item) => item.id === id);
  const added: CardField[] = [];
  for (const part of block?.parts ?? []) {
    const base = newField(part.preset, part.label, [...existing, ...added]);
    added.push(cardFieldSchema.parse({ ...base, span: part.span, ...part.extra }));
  }
  return added;
}

export function overflowingFields(rects: readonly { id: string; bottom: number }[], limit: number): string[] {
  return rects.filter((rect) => rect.bottom > limit + 0.5).map((rect) => rect.id);
}

const MAX_CARD_HEIGHT = 4000;

export function fitCardHeight(height: number, scrollHeight: number, clientHeight: number): number {
  return Math.min(MAX_CARD_HEIGHT, Math.ceil(height + Math.max(0, scrollHeight - clientHeight)));
}
