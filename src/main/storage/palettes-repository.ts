import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  paletteClusterInputSchema,
  paletteClusterListSchema,
  paletteClusterPatchSchema,
  paletteClusterSchema,
  paletteInputSchema,
  paletteListSchema,
  palettePatchSchema,
  paletteSchema,
  type Palette,
  type PaletteCluster,
  type PaletteColourInput,
  type PaletteLibrary,
} from '@shared/colours';
import { transaction } from './tickets-repository';

function now(): string {
  return new Date().toISOString();
}

const PALETTE_COLUMNS =
  'id, name, harmony, base_index AS baseIndex, source, cluster_id AS clusterId, cluster_position AS clusterPosition, created_at AS createdAt, updated_at AS updatedAt';

const CLUSTER_COLUMNS = 'id, name, created_at AS createdAt, updated_at AS updatedAt';

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

function readCluster(db: DatabaseSync, id: string): PaletteCluster {
  const row = db.prepare(`SELECT ${CLUSTER_COLUMNS} FROM palette_clusters WHERE id = ?`).get(id);
  if (!row) throw new Error(`Unknown palette cluster ${id}`);
  return paletteClusterSchema.parse(row);
}

function nextClusterPosition(db: DatabaseSync, clusterId: string): number {
  const row = db
    .prepare('SELECT MAX(cluster_position) AS last FROM palettes WHERE cluster_id = ?')
    .get(clusterId) as { last: number | null } | undefined;
  return row?.last === null || row?.last === undefined ? 0 : row.last + 1;
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

function insertPalette(db: DatabaseSync, raw: unknown): Palette {
  const input = paletteInputSchema.parse(raw);
  if (input.clusterId) readCluster(db, input.clusterId);
  const id = randomUUID();
  const stamp = now();
  db.prepare(
    'INSERT INTO palettes (id, name, harmony, base_index, source, cluster_id, cluster_position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    id,
    input.name,
    input.harmony,
    Math.min(input.baseIndex, input.colours.length - 1),
    input.source,
    input.clusterId,
    input.clusterId ? nextClusterPosition(db, input.clusterId) : 0,
    stamp,
    stamp,
  );
  writeColours(db, id, input.colours);
  return readPalette(db, id);
}

function moveToCluster(db: DatabaseSync, paletteId: string, clusterId: string | null): void {
  db.prepare('UPDATE palettes SET cluster_id = ?, cluster_position = ?, updated_at = ? WHERE id = ?').run(
    clusterId,
    clusterId ? nextClusterPosition(db, clusterId) : 0,
    now(),
    paletteId,
  );
}

export function listPalettes(db: DatabaseSync): Palette[] {
  const rows = db.prepare(`SELECT ${PALETTE_COLUMNS} FROM palettes ORDER BY created_at, id`).all();
  return paletteListSchema.parse(
    rows.map((row) => ({ ...row, colours: readColours(db, (row as { id: string }).id) })),
  );
}

export function listPaletteClusters(db: DatabaseSync): PaletteCluster[] {
  return paletteClusterListSchema.parse(
    db.prepare(`SELECT ${CLUSTER_COLUMNS} FROM palette_clusters ORDER BY created_at, id`).all(),
  );
}

function readLibrary(db: DatabaseSync): PaletteLibrary {
  return { palettes: listPalettes(db), clusters: listPaletteClusters(db) };
}

export function createPalette(db: DatabaseSync, raw: unknown): Palette {
  return transaction(db, () => insertPalette(db, raw));
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
    if (patch.clusterId !== undefined && patch.clusterId !== current.clusterId) {
      if (patch.clusterId) readCluster(db, patch.clusterId);
      moveToCluster(db, id, patch.clusterId);
    }
    return readPalette(db, id);
  });
}

export function deletePalette(db: DatabaseSync, id: string): Palette[] {
  db.prepare('DELETE FROM palettes WHERE id = ?').run(id);
  return listPalettes(db);
}

export function createPaletteCluster(db: DatabaseSync, raw: unknown): PaletteLibrary {
  const input = paletteClusterInputSchema.parse(raw);
  return transaction(db, () => {
    const id = randomUUID();
    const stamp = now();
    db.prepare('INSERT INTO palette_clusters (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
      id,
      input.name,
      stamp,
      stamp,
    );
    for (const paletteId of input.paletteIds) {
      readPalette(db, paletteId);
      moveToCluster(db, paletteId, id);
    }
    for (const palette of input.palettes) insertPalette(db, { ...palette, clusterId: id });
    return readLibrary(db);
  });
}

export function updatePaletteCluster(db: DatabaseSync, id: string, raw: unknown): PaletteCluster {
  const patch = paletteClusterPatchSchema.parse(raw);
  readCluster(db, id);
  db.prepare('UPDATE palette_clusters SET name = ?, updated_at = ? WHERE id = ?').run(patch.name, now(), id);
  return readCluster(db, id);
}

export function deletePaletteCluster(db: DatabaseSync, id: string, withPalettes: boolean): PaletteLibrary {
  return transaction(db, () => {
    if (withPalettes) db.prepare('DELETE FROM palettes WHERE cluster_id = ?').run(id);
    db.prepare('DELETE FROM palette_clusters WHERE id = ?').run(id);
    return readLibrary(db);
  });
}
