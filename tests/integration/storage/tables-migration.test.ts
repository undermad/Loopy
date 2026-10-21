import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { projectMigrations } from '../../../src/main/storage/project-migrations';
import { migrateDatabase, readUserVersion } from '../../../src/main/storage/sql-migrations';

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-tables-migration-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

const STAMP = '2026-01-01T00:00:00.000Z';

function open(): DatabaseSync {
  const db = new DatabaseSync(join(directory, 'older.loopy'));
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

describe('data tables migration', () => {
  it('keeps folders and their contents while adding the tables scope', () => {
    const db = open();
    const before = projectMigrations.findIndex((sql) => sql.includes('CREATE TABLE data_tables'));
    expect(before).toBeGreaterThan(16);
    migrateDatabase(db, projectMigrations.slice(0, before));
    db.exec(`
      INSERT INTO asset_folders (id, parent_id, name, created_at, updated_at, scope)
        VALUES ('f-cards', NULL, 'Heroes', '${STAMP}', '${STAMP}', 'cards'),
               ('f-sub', 'f-cards', 'Knights', '${STAMP}', '${STAMP}', 'cards'),
               ('f-notes', NULL, 'Lore', '${STAMP}', '${STAMP}', 'notes');
      INSERT INTO cards (id, folder_id, name, field_values, created_at, updated_at)
        VALUES ('c1', 'f-sub', 'Knight', '{}', '${STAMP}', '${STAMP}');
      INSERT INTO notes (id, folder_id, title, body, created_at, updated_at)
        VALUES ('n1', 'f-notes', 'Elves', '', '${STAMP}', '${STAMP}');
    `);

    migrateDatabase(db, projectMigrations);

    expect(readUserVersion(db)).toBe(projectMigrations.length);
    const folders = `SELECT id, parent_id AS parentId, scope FROM asset_folders WHERE id LIKE 'f-%' ORDER BY id`;
    expect(db.prepare(folders).all()).toEqual([
      { id: 'f-cards', parentId: null, scope: 'cards' },
      { id: 'f-notes', parentId: null, scope: 'notes' },
      { id: 'f-sub', parentId: 'f-cards', scope: 'cards' },
    ]);
    expect(db.prepare('SELECT folder_id AS folderId FROM cards').get()).toEqual({ folderId: 'f-sub' });
    expect(db.prepare('SELECT folder_id AS folderId FROM notes').get()).toEqual({ folderId: 'f-notes' });
    db.exec(`INSERT INTO asset_folders (id, parent_id, name, created_at, updated_at, scope)
      VALUES ('f-tables', NULL, 'Enemies', '${STAMP}', '${STAMP}', 'tables')`);
    db.close();
  });

  it('stores rows under a table, keeps keys unique per table and deletes rows with the table', () => {
    const db = open();
    migrateDatabase(db, projectMigrations);
    db.exec(`
      INSERT INTO data_tables (id, folder_id, name, key_name, columns, created_at, updated_at)
        VALUES ('t1', NULL, 'Items', 'id', '[]', '${STAMP}', '${STAMP}'),
               ('t2', NULL, 'Enemies', 'id', '[]', '${STAMP}', '${STAMP}');
      INSERT INTO data_rows (id, table_id, key, position, cells, created_at, updated_at)
        VALUES ('r1', 't1', 'sword', 'a', '{}', '${STAMP}', '${STAMP}'),
               ('r2', 't2', 'sword', 'a', '{}', '${STAMP}', '${STAMP}');
    `);
    expect(() => {
      db.exec(`INSERT INTO data_rows (id, table_id, key, position, cells, created_at, updated_at)
        VALUES ('r3', 't1', 'sword', 'b', '{}', '${STAMP}', '${STAMP}')`);
    }).toThrow();
    expect(() => {
      db.exec(`INSERT INTO data_tables (id, name, created_at, updated_at) VALUES ('t3', '', 'x', 'x')`);
    }).toThrow();

    db.exec("DELETE FROM data_tables WHERE id = 't1'");

    expect(db.prepare('SELECT id FROM data_rows').all()).toEqual([{ id: 'r2' }]);
    db.close();
  });
});
