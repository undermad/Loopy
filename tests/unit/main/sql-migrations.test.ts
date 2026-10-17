import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UnsupportedVersionError } from '../../../src/main/storage/migrations';
import { migrateDatabase, readUserVersion } from '../../../src/main/storage/sql-migrations';

const migrations = [
  'CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL);',
  'ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;',
];

let db: DatabaseSync;

beforeEach(() => {
  db = new DatabaseSync(':memory:');
});

afterEach(() => {
  db.close();
});

function columns(table: string): string[] {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((row) => String(row['name']));
}

describe('migrateDatabase', () => {
  it('applies every migration in order and stamps the user version', () => {
    migrateDatabase(db, migrations);

    expect(readUserVersion(db)).toBe(2);
    expect(columns('notes')).toEqual(['id', 'body', 'pinned']);
  });

  it('continues from the recorded version', () => {
    migrateDatabase(db, migrations.slice(0, 1));
    expect(readUserVersion(db)).toBe(1);

    migrateDatabase(db, migrations);
    expect(readUserVersion(db)).toBe(2);
    expect(columns('notes')).toEqual(['id', 'body', 'pinned']);
  });

  it('does nothing when already at the target version', () => {
    migrateDatabase(db, migrations);
    expect(() => {
      migrateDatabase(db, migrations);
    }).not.toThrow();
    expect(readUserVersion(db)).toBe(2);
  });

  it('rejects a version newer than the migrations it knows', () => {
    db.exec('PRAGMA user_version = 5');
    expect(() => {
      migrateDatabase(db, migrations);
    }).toThrow(UnsupportedVersionError);
  });

  it('rolls back every step when one fails', () => {
    expect(() => {
      migrateDatabase(db, [...migrations, 'ALTER TABLE missing ADD COLUMN x INTEGER;']);
    }).toThrow();

    expect(readUserVersion(db)).toBe(0);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()).toEqual([]);
  });
});
