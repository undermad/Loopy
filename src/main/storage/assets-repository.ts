import { createHash, randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  assetIdsSchema,
  assetImportSchema,
  assetKindOf,
  assetMimeOf,
  assetPatchSchema,
  assetSettingsPatchSchema,
  assetSettingsSchema,
  assetsSnapshotSchema,
  folderInputSchema,
  type AssetScope,
  folderPatchSchema,
  resolveDropFolder,
  type AssetSettings,
  type AssetsSnapshot,
} from '@shared/assets';
import { readImageSize } from './image-size';
import { transaction } from './tickets-repository';

const SETTINGS_KEY = 'assets';

function now(): string {
  return new Date().toISOString();
}

export function readAssetSettings(db: DatabaseSync): AssetSettings {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SETTINGS_KEY) as
    { value: string } | undefined;
  if (!row) return assetSettingsSchema.parse({});
  try {
    const parsed = assetSettingsSchema.safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : assetSettingsSchema.parse({});
  } catch {
    return assetSettingsSchema.parse({});
  }
}

function writeAssetSettings(db: DatabaseSync, settings: AssetSettings): void {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(SETTINGS_KEY, JSON.stringify(settings));
}

export function readAssetsSnapshot(db: DatabaseSync): AssetsSnapshot {
  const folders = db
    .prepare(
      'SELECT id, parent_id AS parentId, scope, name, created_at AS createdAt, updated_at AS updatedAt FROM asset_folders ORDER BY name, id',
    )
    .all();
  const assets = db
    .prepare(
      `SELECT id, folder_id AS folderId, name, kind, mime, size, sha256, width, height, tags,
        created_at AS createdAt, updated_at AS updatedAt FROM assets ORDER BY name, id`,
    )
    .all()
    .map((row) => ({
      ...(row as Record<string, unknown>),
      tags: JSON.parse((row as { tags: string }).tags) as unknown,
    }));
  return assetsSnapshotSchema.parse({ folders, assets, settings: readAssetSettings(db) });
}

function folderIds(db: DatabaseSync): Set<string> {
  return new Set((db.prepare('SELECT id FROM asset_folders').all() as { id: string }[]).map((row) => row.id));
}

function folderScope(db: DatabaseSync, id: string): AssetScope {
  const row = db.prepare('SELECT scope FROM asset_folders WHERE id = ?').get(id) as
    { scope: AssetScope } | undefined;
  if (!row) throw new Error(`Unknown folder ${id}`);
  return row.scope;
}

export function assertFolderScope(db: DatabaseSync, id: string | null, scope: AssetScope): void {
  if (id !== null && folderScope(db, id) !== scope) throw new Error(`Folder ${id} does not hold ${scope}`);
}

function assertFolder(db: DatabaseSync, id: string | null): void {
  assertFolderScope(db, id, 'files');
}

function isDescendant(db: DatabaseSync, folderId: string, ancestorId: string): boolean {
  let current: string | null = folderId;
  const seen = new Set<string>();
  while (current !== null && !seen.has(current)) {
    if (current === ancestorId) return true;
    seen.add(current);
    const row = db.prepare('SELECT parent_id AS parentId FROM asset_folders WHERE id = ?').get(current) as
      { parentId: string | null } | undefined;
    current = row?.parentId ?? null;
  }
  return false;
}

export function createFolder(db: DatabaseSync, raw: unknown): AssetsSnapshot {
  const input = folderInputSchema.parse(raw);
  assertFolderScope(db, input.parentId, input.scope);
  const stamp = now();
  db.prepare(
    'INSERT INTO asset_folders (id, parent_id, scope, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(randomUUID(), input.parentId, input.scope, input.name, stamp, stamp);
  return readAssetsSnapshot(db);
}

export function updateFolder(db: DatabaseSync, id: string, raw: unknown): AssetsSnapshot {
  const patch = folderPatchSchema.parse(raw);
  return transaction(db, () => {
    const sets = ['updated_at = ?'];
    const values: (string | null)[] = [now()];
    if (patch.name !== undefined) {
      sets.push('name = ?');
      values.push(patch.name);
    }
    if (patch.parentId !== undefined) {
      assertFolderScope(db, patch.parentId, folderScope(db, id));
      if (patch.parentId !== null && isDescendant(db, patch.parentId, id)) {
        throw new Error(`Folder ${id} cannot move into itself`);
      }
      sets.push('parent_id = ?');
      values.push(patch.parentId);
    }
    const result = db.prepare(`UPDATE asset_folders SET ${sets.join(', ')} WHERE id = ?`).run(...values, id);
    if (result.changes === 0) throw new Error(`Unknown folder ${id}`);
    return readAssetsSnapshot(db);
  });
}

export function deleteFolder(db: DatabaseSync, id: string): AssetsSnapshot {
  return transaction(db, () => {
    const row = db.prepare('SELECT parent_id AS parentId FROM asset_folders WHERE id = ?').get(id) as
      { parentId: string | null } | undefined;
    if (!row) throw new Error(`Unknown folder ${id}`);
    const stamp = now();
    db.prepare('UPDATE assets SET folder_id = ?, updated_at = ? WHERE folder_id = ?').run(
      row.parentId,
      stamp,
      id,
    );
    for (const table of ['boards', 'palettes', 'notes']) {
      db.prepare(`UPDATE ${table} SET folder_id = ? WHERE folder_id = ?`).run(row.parentId, id);
    }
    db.prepare('UPDATE asset_folders SET parent_id = ?, updated_at = ? WHERE parent_id = ?').run(
      row.parentId,
      stamp,
      id,
    );
    db.prepare('DELETE FROM asset_folders WHERE id = ?').run(id);
    return readAssetsSnapshot(db);
  });
}

export interface ImportedAssets {
  snapshot: AssetsSnapshot;
  ids: string[];
}

export function importAssets(db: DatabaseSync, raw: unknown): ImportedAssets {
  const input = assetImportSchema.parse(raw);
  return transaction(db, () => {
    const settings = readAssetSettings(db);
    const existing = folderIds(db);
    if (input.target !== 'auto' && input.target !== null && !existing.has(input.target)) {
      throw new Error(`Unknown folder ${input.target}`);
    }
    const insert = db.prepare(
      `INSERT INTO assets (id, folder_id, name, kind, mime, size, sha256, width, height, tags, bytes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?)`,
    );
    const ids: string[] = [];
    for (const file of input.files) {
      const kind = assetKindOf(file.name, file.mime);
      const folderId = input.target === 'auto' ? resolveDropFolder(settings, kind, existing) : input.target;
      const size = kind === 'image' ? readImageSize(file.bytes) : null;
      const id = randomUUID();
      const stamp = now();
      insert.run(
        id,
        folderId,
        file.name,
        kind,
        assetMimeOf(file.name, file.mime),
        file.bytes.byteLength,
        createHash('sha256').update(file.bytes).digest('hex'),
        size?.width ?? null,
        size?.height ?? null,
        file.bytes,
        stamp,
        stamp,
      );
      ids.push(id);
    }
    return { snapshot: readAssetsSnapshot(db), ids };
  });
}

export function updateAsset(db: DatabaseSync, id: string, raw: unknown): AssetsSnapshot {
  const patch = assetPatchSchema.parse(raw);
  const sets = ['updated_at = ?'];
  const values: (string | null)[] = [now()];
  if (patch.name !== undefined) {
    sets.push('name = ?');
    values.push(patch.name);
  }
  if (patch.folderId !== undefined) {
    assertFolder(db, patch.folderId);
    sets.push('folder_id = ?');
    values.push(patch.folderId);
  }
  if (patch.tags !== undefined) {
    sets.push('tags = ?');
    values.push(JSON.stringify([...new Set(patch.tags)]));
  }
  const result = db.prepare(`UPDATE assets SET ${sets.join(', ')} WHERE id = ?`).run(...values, id);
  if (result.changes === 0) throw new Error(`Unknown asset ${id}`);
  return readAssetsSnapshot(db);
}

export function moveAssets(db: DatabaseSync, rawIds: unknown, folderId: string | null): AssetsSnapshot {
  const ids = assetIdsSchema.parse(rawIds);
  return transaction(db, () => {
    assertFolder(db, folderId);
    const update = db.prepare('UPDATE assets SET folder_id = ?, updated_at = ? WHERE id = ?');
    const stamp = now();
    for (const id of ids) update.run(folderId, stamp, id);
    return readAssetsSnapshot(db);
  });
}

export function deleteAssets(db: DatabaseSync, rawIds: unknown): AssetsSnapshot {
  const ids = assetIdsSchema.parse(rawIds);
  return transaction(db, () => {
    const remove = db.prepare('DELETE FROM assets WHERE id = ?');
    for (const id of ids) remove.run(id);
    return readAssetsSnapshot(db);
  });
}

export function updateAssetSettings(db: DatabaseSync, raw: unknown): AssetsSnapshot {
  const patch = assetSettingsPatchSchema.parse(raw);
  const current = readAssetSettings(db);
  const next = assetSettingsSchema.parse({
    ...current,
    ...patch,
    kindFolders: { ...current.kindFolders, ...(patch.kindFolders ?? {}) },
  });
  writeAssetSettings(db, next);
  return readAssetsSnapshot(db);
}

export interface AssetBytes {
  mime: string;
  bytes: Uint8Array;
}

export function readAssetBytes(db: DatabaseSync, id: string): AssetBytes | null {
  const row = db.prepare('SELECT mime, bytes FROM assets WHERE id = ?').get(id) as
    { mime: string; bytes: Uint8Array } | undefined;
  return row ? { mime: row.mime, bytes: row.bytes } : null;
}

export function readAssetName(db: DatabaseSync, id: string): string | null {
  const row = db.prepare('SELECT name FROM assets WHERE id = ?').get(id) as { name: string } | undefined;
  return row?.name ?? null;
}
