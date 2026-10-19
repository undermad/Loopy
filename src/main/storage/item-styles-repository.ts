import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  itemStylePresetInputSchema,
  itemStylePresetListSchema,
  itemStylePresetPatchSchema,
  itemStylePresetSchema,
  type ItemStylePreset,
} from '@shared/item-styles';

const COLUMNS = 'id, name, style, created_at AS createdAt, updated_at AS updatedAt';

interface StyleRow {
  id: string;
  name: string;
  style: string;
  createdAt: string;
  updatedAt: string;
}

function toPreset(row: StyleRow): ItemStylePreset {
  return itemStylePresetSchema.parse({ ...row, style: JSON.parse(row.style) as unknown });
}

function readPreset(db: DatabaseSync, id: string): ItemStylePreset {
  const row = db.prepare(`SELECT ${COLUMNS} FROM item_styles WHERE id = ?`).get(id) as StyleRow | undefined;
  if (!row) throw new Error(`Unknown item style ${id}`);
  return toPreset(row);
}

export function listItemStyles(db: DatabaseSync): ItemStylePreset[] {
  const rows = db
    .prepare(`SELECT ${COLUMNS} FROM item_styles ORDER BY name COLLATE NOCASE, id`)
    .all() as unknown as StyleRow[];
  return itemStylePresetListSchema.parse(rows.map(toPreset));
}

export function createItemStyle(db: DatabaseSync, raw: unknown): ItemStylePreset {
  const input = itemStylePresetInputSchema.parse(raw);
  const id = randomUUID();
  const stamp = new Date().toISOString();
  db.prepare('INSERT INTO item_styles (id, name, style, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
    id,
    input.name,
    JSON.stringify(input.style),
    stamp,
    stamp,
  );
  return readPreset(db, id);
}

export function updateItemStyle(db: DatabaseSync, id: string, raw: unknown): ItemStylePreset {
  const patch = itemStylePresetPatchSchema.parse(raw);
  const current = readPreset(db, id);
  db.prepare('UPDATE item_styles SET name = ?, style = ?, updated_at = ? WHERE id = ?').run(
    patch.name ?? current.name,
    JSON.stringify(patch.style ?? current.style),
    new Date().toISOString(),
    id,
  );
  return readPreset(db, id);
}

export function deleteItemStyle(db: DatabaseSync, id: string): ItemStylePreset[] {
  db.prepare('DELETE FROM item_styles WHERE id = ?').run(id);
  return listItemStyles(db);
}
