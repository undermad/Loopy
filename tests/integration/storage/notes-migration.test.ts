import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { projectMigrations } from '../../../src/main/storage/project-migrations';
import { migrateDatabase } from '../../../src/main/storage/sql-migrations';

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-notes-migration-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

const STAMP = '2026-01-01T00:00:00.000Z';

describe('notes migration', () => {
  it('adds notes and a notes folder scope while keeping every folder link', () => {
    const db = new DatabaseSync(join(directory, 'legacy.loopy'));
    db.exec('PRAGMA foreign_keys = ON');
    migrateDatabase(
      db,
      projectMigrations.slice(
        0,
        projectMigrations.findIndex((sql) => sql.includes('CREATE TABLE notes')),
      ),
    );
    db.exec(`
      INSERT INTO asset_folders (id, parent_id, scope, name, created_at, updated_at) VALUES
        ('top', NULL, 'boards', 'Levels', '${STAMP}', '${STAMP}'),
        ('child', 'top', 'boards', 'World 1', '${STAMP}', '${STAMP}'),
        ('swatches', NULL, 'palettes', 'Swatches', '${STAMP}', '${STAMP}');
      INSERT INTO boards (id, name, background_color, created_at, updated_at, folder_id)
        VALUES ('b1', 'Map', '#ffffff', '${STAMP}', '${STAMP}', 'child');
      INSERT INTO palettes (id, name, harmony, created_at, updated_at, folder_id)
        VALUES ('p1', 'Forest', 'analogous', '${STAMP}', '${STAMP}', 'swatches');
    `);

    migrateDatabase(db, projectMigrations);

    const parent = db.prepare("SELECT parent_id AS parentId FROM asset_folders WHERE id = 'child'").get();
    const board = db.prepare("SELECT folder_id AS folderId FROM boards WHERE id = 'b1'").get();
    const palette = db.prepare("SELECT folder_id AS folderId FROM palettes WHERE id = 'p1'").get();
    db.exec(`INSERT INTO asset_folders (id, parent_id, scope, name, created_at, updated_at)
      VALUES ('ideas', NULL, 'notes', 'Ideas', '${STAMP}', '${STAMP}')`);
    db.exec(`INSERT INTO notes (id, folder_id, title, body, created_at, updated_at)
      VALUES ('n1', 'ideas', 'Enemy AI', '# Enemy AI', '${STAMP}', '${STAMP}')`);
    const duplicate = () => {
      db.exec(
        `INSERT INTO notes (id, title, created_at, updated_at) VALUES ('n2', 'enemy ai', '${STAMP}', '${STAMP}')`,
      );
    };
    expect(duplicate).toThrow(/UNIQUE/);
    const foreignKeys = db.prepare('PRAGMA foreign_key_check').all();
    db.close();

    expect(parent).toEqual({ parentId: 'top' });
    expect(board).toEqual({ folderId: 'child' });
    expect(palette).toEqual({ folderId: 'swatches' });
    expect(foreignKeys).toEqual([]);
  });

  it('adds note versions that go with their note', () => {
    const db = new DatabaseSync(join(directory, 'versions.loopy'));
    db.exec('PRAGMA foreign_keys = ON');
    migrateDatabase(
      db,
      projectMigrations.slice(
        0,
        projectMigrations.findIndex((sql) => sql.includes('CREATE TABLE note_versions')),
      ),
    );
    db.exec(
      `INSERT INTO notes (id, title, body, created_at, updated_at) VALUES ('n1', 'Pitch', 'Old', '${STAMP}', '${STAMP}')`,
    );
    migrateDatabase(db, projectMigrations);
    db.exec(`INSERT INTO note_versions (id, note_id, title, body, created_at)
      VALUES ('v1', 'n1', 'Pitch', 'Older', '${STAMP}')`);
    const before = db.prepare('SELECT COUNT(*) AS count FROM note_versions').get();
    db.exec("DELETE FROM notes WHERE id = 'n1'");
    const after = db.prepare('SELECT COUNT(*) AS count FROM note_versions').get();
    db.close();
    expect(before).toEqual({ count: 1 });
    expect(after).toEqual({ count: 0 });
  });
});
