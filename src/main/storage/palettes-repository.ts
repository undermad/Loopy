import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  paletteInputSchema,
  paletteListSchema,
  palettePatchSchema,
  paletteSchema,
  type Palette,
  type PaletteColourInput,
} from '@shared/colours';
import { transaction } from './tickets-repository';

function now(): string {
  return new Date().toISOString();
}

const PALETTE_COLUMNS =
  'id, name, harmony, base_index AS baseIndex, source, created_at AS createdAt, updated_at AS updatedAt';

function readColours(db: DatabaseSync, paletteId: string): unknown[] {
  return db
    .prepare('SELECT id, name, hex FROM palette_colours WHERE palette_id = ? ORDER BY position')
    .all(paletteId);
}

function readPalette(db: DatabaseSync, id: string): Palette {
  const row = db.prepare(`SELECT ${PALETTE_COLUMNS} FROM palettes WHERE id = ?`).get(id);
  if (!row) throw new Error(`Unknown palette ${id}`);
  return paletteSchema.parse({ ...row, colours: readColours(db, id) });
}

function writeColours(db: DatabaseSync, paletteId: string, colours: PaletteColourInput[]): void {
  const ids = colours.map((colour) => colour.id ?? randomUUID());
  const keep = ids.map(() => '?').join(', ');
  db.prepare(`DELETE FROM palette_colours WHERE palette_id = ? AND id NOT IN (${keep})`).run(
    paletteId,
    ...ids,
  );
  const upsert = db.prepare(
    `INSERT INTO palette_colours (id, palette_id, position, name, hex) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET position = excluded.position, name = excluded.name, hex = excluded.hex`,
  );
  colours.forEach((colour, index) => {
    upsert.run(ids[index] ?? randomUUID(), paletteId, index, colour.name ?? '', colour.hex.toLowerCase());
  });
}

export function listPalettes(db: DatabaseSync): Palette[] {
  const rows = db.prepare(`SELECT ${PALETTE_COLUMNS} FROM palettes ORDER BY created_at, id`).all();
  return paletteListSchema.parse(
    rows.map((row) => ({ ...row, colours: readColours(db, (row as { id: string }).id) })),
  );
}

export function createPalette(db: DatabaseSync, raw: unknown): Palette {
  const input = paletteInputSchema.parse(raw);
  const id = randomUUID();
  const stamp = now();
  return transaction(db, () => {
    db.prepare(
      'INSERT INTO palettes (id, name, harmony, base_index, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(
      id,
      input.name,
      input.harmony,
      Math.min(input.baseIndex, input.colours.length - 1),
      input.source,
      stamp,
      stamp,
    );
    writeColours(db, id, input.colours);
    return readPalette(db, id);
  });
}

export function updatePalette(db: DatabaseSync, id: string, raw: unknown): Palette {
  const patch = palettePatchSchema.parse(raw);
  return transaction(db, () => {
    const current = readPalette(db, id);
    const colourCount = patch.colours?.length ?? current.colours.length;
    const sets = ['updated_at = ?'];
    const values: (string | number)[] = [now()];
    if (patch.name !== undefined) {
      sets.push('name = ?');
      values.push(patch.name);
    }
    if (patch.harmony !== undefined) {
      sets.push('harmony = ?');
      values.push(patch.harmony);
    }
    const baseIndex = Math.min(patch.baseIndex ?? current.baseIndex, colourCount - 1);
    sets.push('base_index = ?');
    values.push(baseIndex);
    db.prepare(`UPDATE palettes SET ${sets.join(', ')} WHERE id = ?`).run(...values, id);
    if (patch.colours) writeColours(db, id, patch.colours);
    return readPalette(db, id);
  });
}

export function deletePalette(db: DatabaseSync, id: string): Palette[] {
  db.prepare('DELETE FROM palettes WHERE id = ?').run(id);
  return listPalettes(db);
}
