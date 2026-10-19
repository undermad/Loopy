import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  cardLayoutSchema,
  cardTemplateInputSchema,
  cardTemplateListSchema,
  cardTemplatePatchSchema,
  cardTemplateSchema,
  type CardLayout,
  type CardTemplate,
} from '@shared/cards';

function now(): string {
  return new Date().toISOString();
}

const COLUMNS = 'id, name, data, created_at AS createdAt, updated_at AS updatedAt';

interface TemplateRow {
  id: string;
  name: string;
  data: string;
  createdAt: string;
  updatedAt: string;
}

function toTemplate(row: TemplateRow): CardTemplate {
  const layout = cardLayoutSchema.parse(JSON.parse(row.data) as unknown);
  return cardTemplateSchema.parse({
    ...layout,
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function readTemplate(db: DatabaseSync, id: string): CardTemplate {
  const row = db.prepare(`SELECT ${COLUMNS} FROM card_templates WHERE id = ?`).get(id) as
    TemplateRow | undefined;
  if (!row) throw new Error(`Unknown card template ${id}`);
  return toTemplate(row);
}

export function layoutJson(template: CardLayout): string {
  return JSON.stringify(cardLayoutSchema.parse(template));
}

export function assertUniqueFieldIds(fields: { id: string }[]): void {
  const ids = new Set<string>();
  for (const field of fields) {
    if (ids.has(field.id)) throw new Error(`Duplicate field id ${field.id}`);
    ids.add(field.id);
  }
}

export function listCardTemplates(db: DatabaseSync): CardTemplate[] {
  const rows = db
    .prepare(`SELECT ${COLUMNS} FROM card_templates ORDER BY created_at, id`)
    .all() as unknown as TemplateRow[];
  return cardTemplateListSchema.parse(rows.map(toTemplate));
}

export function createCardTemplate(db: DatabaseSync, raw: unknown): CardTemplate {
  const input = cardTemplateInputSchema.parse(raw);
  assertUniqueFieldIds(input.fields);
  const id = randomUUID();
  const stamp = now();
  db.prepare(
    'INSERT INTO card_templates (id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, input.name, layoutJson(input), stamp, stamp);
  return readTemplate(db, id);
}

export function updateCardTemplate(db: DatabaseSync, id: string, raw: unknown): CardTemplate {
  const patch = cardTemplatePatchSchema.parse(raw);
  const current = readTemplate(db, id);
  const next = {
    ...current,
    ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)),
  };
  const parsed = cardTemplateInputSchema.parse(next);
  assertUniqueFieldIds(parsed.fields);
  db.prepare('UPDATE card_templates SET name = ?, data = ?, updated_at = ? WHERE id = ?').run(
    parsed.name,
    layoutJson(parsed),
    now(),
    id,
  );
  return readTemplate(db, id);
}

export function deleteCardTemplate(db: DatabaseSync, id: string): CardTemplate[] {
  db.prepare('DELETE FROM card_templates WHERE id = ?').run(id);
  return listCardTemplates(db);
}
