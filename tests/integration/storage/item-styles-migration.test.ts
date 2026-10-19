import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { projectMigrations } from '../../../src/main/storage/project-migrations';
import { migrateDatabase, readUserVersion } from '../../../src/main/storage/sql-migrations';

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-styles-migration-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('item style presets migration', () => {
  it('adds the item_styles table to an existing project', () => {
    const db = new DatabaseSync(join(directory, 'older.loopy'));
    const before = projectMigrations.findIndex((sql) => sql.includes('CREATE TABLE item_styles'));
    expect(before).toBeGreaterThan(0);
    migrateDatabase(db, projectMigrations.slice(0, before));
    expect(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'item_styles'").get(),
    ).toBeUndefined();

    migrateDatabase(db, projectMigrations);

    expect(readUserVersion(db)).toBe(projectMigrations.length);
    db.exec(
      `INSERT INTO item_styles (id, name, style, created_at, updated_at)
       VALUES ('s1', 'Warning', '{}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    );
    expect(db.prepare('SELECT name FROM item_styles').all()).toEqual([{ name: 'Warning' }]);
    expect(() => {
      db.exec(
        "INSERT INTO item_styles (id, name, style, created_at, updated_at) VALUES ('s2', '', '{}', 'x', 'x')",
      );
    }).toThrow();
    db.close();
  });
});
