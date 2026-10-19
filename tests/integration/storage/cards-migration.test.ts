import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { projectMigrations } from '../../../src/main/storage/project-migrations';
import { migrateDatabase } from '../../../src/main/storage/sql-migrations';

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-cards-migration-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

const STAMP = '2026-01-01T00:00:00.000Z';

describe('saved cards migration', () => {
  it('adds saved cards and a cards folder scope while keeping every folder link', () => {
    const db = new DatabaseSync(join(directory, 'legacy.loopy'));
    db.exec('PRAGMA foreign_keys = ON');
    migrateDatabase(
      db,
      projectMigrations.slice(
        0,
        projectMigrations.findIndex((sql) => sql.includes('CREATE TABLE cards')),
      ),
    );
    db.exec(`
      INSERT INTO asset_folders (id, parent_id, scope, name, created_at, updated_at) VALUES
        ('top', NULL, 'boards', 'Levels', '${STAMP}', '${STAMP}'),
        ('child', 'top', 'boards', 'World 1', '${STAMP}', '${STAMP}'),
        ('swatches', NULL, 'palettes', 'Swatches', '${STAMP}', '${STAMP}'),
        ('ideas', NULL, 'notes', 'Ideas', '${STAMP}', '${STAMP}'),
        ('sprites', NULL, 'files', 'Sprites', '${STAMP}', '${STAMP}');
      INSERT INTO boards (id, name, background_color, created_at, updated_at, folder_id)
        VALUES ('b1', 'Map', '#ffffff', '${STAMP}', '${STAMP}', 'child');
      INSERT INTO palettes (id, name, harmony, created_at, updated_at, folder_id)
        VALUES ('p1', 'Forest', 'analogous', '${STAMP}', '${STAMP}', 'swatches');
      INSERT INTO notes (id, folder_id, title, body, created_at, updated_at)
        VALUES ('n1', 'ideas', 'Pitch', '', '${STAMP}', '${STAMP}');
      INSERT INTO card_templates (id, name, data, created_at, updated_at)
        VALUES ('t1', 'Hero', '{}', '${STAMP}', '${STAMP}');
    `);

    migrateDatabase(db, projectMigrations);

    const rows = {
      parent: db.prepare("SELECT parent_id AS parentId FROM asset_folders WHERE id = 'child'").get(),
      board: db.prepare("SELECT folder_id AS folderId FROM boards WHERE id = 'b1'").get(),
      palette: db.prepare("SELECT folder_id AS folderId FROM palettes WHERE id = 'p1'").get(),
      note: db.prepare("SELECT folder_id AS folderId FROM notes WHERE id = 'n1'").get(),
      scopes: db
        .prepare(
          "SELECT id, scope FROM asset_folders WHERE id IN ('top', 'child', 'swatches', 'ideas', 'sprites') ORDER BY id",
        )
        .all(),
    };
    db.exec(`INSERT INTO asset_folders (id, parent_id, scope, name, created_at, updated_at)
      VALUES ('heroes', NULL, 'cards', 'Heroes', '${STAMP}', '${STAMP}')`);
    db.exec(`INSERT INTO cards (id, folder_id, name, template_id, layout, field_values, created_at, updated_at)
      VALUES ('c1', 'heroes', 'Knight', 't1', NULL, '{}', '${STAMP}', '${STAMP}')`);
    const badScope = () => {
      db.exec(`INSERT INTO asset_folders (id, parent_id, scope, name, created_at, updated_at)
        VALUES ('x', NULL, 'tickets', 'X', '${STAMP}', '${STAMP}')`);
    };
    expect(badScope).toThrow(/CHECK/);
    db.exec("DELETE FROM card_templates WHERE id = 't1'");
    const detached = db.prepare("SELECT template_id AS templateId FROM cards WHERE id = 'c1'").get();
    const foreignKeys = db.prepare('PRAGMA foreign_key_check').all();
    db.close();

    expect(rows.parent).toEqual({ parentId: 'top' });
    expect(rows.board).toEqual({ folderId: 'child' });
    expect(rows.palette).toEqual({ folderId: 'swatches' });
    expect(rows.note).toEqual({ folderId: 'ideas' });
    expect(rows.scopes).toEqual([
      { id: 'child', scope: 'boards' },
      { id: 'ideas', scope: 'notes' },
      { id: 'sprites', scope: 'files' },
      { id: 'swatches', scope: 'palettes' },
      { id: 'top', scope: 'boards' },
    ]);
    expect(detached).toEqual({ templateId: null });
    expect(foreignKeys).toEqual([]);
  });
});
