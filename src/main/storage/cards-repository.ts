import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  cardLayoutSchema,
  savedCardInputSchema,
  savedCardListSchema,
  savedCardPatchSchema,
  savedCardSchema,
  type CardLayout,
  type SavedCard,
} from '@shared/cards';
import { assertFolderScope } from './assets-repository';
import { assertUniqueFieldIds, layoutJson, readTemplate } from './card-templates-repository';
import { transaction } from './tickets-repository';

const COLUMNS =
  'id, folder_id AS folderId, name, template_id AS templateId, layout, field_values AS fieldValues, created_at AS createdAt, updated_at AS updatedAt';

interface CardRow {
  id: string;
  folderId: string | null;
  name: string;
  templateId: string | null;
  layout: string | null;
  fieldValues: string;
  createdAt: string;
  updatedAt: string;
}

function now(): string {
  return new Date().toISOString();
}

function toCard(row: CardRow): SavedCard {
  const layout = row.layout === null ? null : (JSON.parse(row.layout) as unknown);
  return savedCardSchema.parse({
    id: row.id,
    folderId: row.folderId,
    name: row.name,
    templateId: row.templateId,
    layout: layout ?? (row.templateId === null ? cardLayoutSchema.parse({}) : null),
    values: JSON.parse(row.fieldValues) as unknown,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function readCard(db: DatabaseSync, id: string): SavedCard {
  const row = db.prepare(`SELECT ${COLUMNS} FROM cards WHERE id = ?`).get(id) as CardRow | undefined;
  if (!row) throw new Error(`Unknown card ${id}`);
  return toCard(row);
}

function templateLayout(db: DatabaseSync, templateId: string): CardLayout {
  return cardLayoutSchema.parse(readTemplate(db, templateId));
}

function ownLayout(layout: CardLayout | null): string {
  const resolved = layout ?? cardLayoutSchema.parse({});
  assertUniqueFieldIds(resolved.fields);
  return layoutJson(resolved);
}

export function listCards(db: DatabaseSync): SavedCard[] {
  const rows = db
    .prepare(`SELECT ${COLUMNS} FROM cards ORDER BY created_at, id`)
    .all() as unknown as CardRow[];
  return savedCardListSchema.parse(rows.map(toCard));
}

export function createCard(db: DatabaseSync, raw: unknown): SavedCard {
  const input = savedCardInputSchema.parse(raw);
  assertFolderScope(db, input.folderId, 'cards');
  if (input.templateId !== null) readTemplate(db, input.templateId);
  const layout = input.templateId === null ? ownLayout(input.layout) : null;
  const id = randomUUID();
  const stamp = now();
  db.prepare(
    'INSERT INTO cards (id, folder_id, name, template_id, layout, field_values, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, input.folderId, input.name, input.templateId, layout, JSON.stringify(input.values), stamp, stamp);
  return readCard(db, id);
}

export function updateCard(db: DatabaseSync, id: string, raw: unknown): SavedCard {
  const patch = savedCardPatchSchema.parse(raw);
  return transaction(db, () => {
    const current = readCard(db, id);
    const name = patch.name ?? current.name;
    const folderId = patch.folderId === undefined ? current.folderId : patch.folderId;
    if (patch.folderId !== undefined) assertFolderScope(db, folderId, 'cards');
    const values = patch.values ?? current.values;
    const templateId = patch.templateId === undefined ? current.templateId : patch.templateId;
    let layout: string | null = null;
    if (templateId !== null) {
      readTemplate(db, templateId);
    } else if (patch.layout !== undefined && patch.layout !== null) {
      layout = ownLayout(patch.layout);
    } else if (current.templateId !== null) {
      layout = ownLayout(templateLayout(db, current.templateId));
    } else {
      layout = ownLayout(current.layout);
    }
    db.prepare(
      'UPDATE cards SET name = ?, folder_id = ?, template_id = ?, layout = ?, field_values = ?, updated_at = ? WHERE id = ?',
    ).run(name, folderId, templateId, layout, JSON.stringify(values), now(), id);
    return readCard(db, id);
  });
}

export function deleteCard(db: DatabaseSync, id: string): SavedCard[] {
  db.prepare('DELETE FROM cards WHERE id = ?').run(id);
  return listCards(db);
}

export function detachTemplateCards(db: DatabaseSync, templateId: string): void {
  const used = db.prepare('SELECT 1 FROM cards WHERE template_id = ? LIMIT 1').get(templateId);
  if (!used) return;
  db.prepare('UPDATE cards SET template_id = NULL, layout = ?, updated_at = ? WHERE template_id = ?').run(
    layoutJson(templateLayout(db, templateId)),
    now(),
    templateId,
  );
}
