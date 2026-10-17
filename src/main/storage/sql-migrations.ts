import type { DatabaseSync } from 'node:sqlite';
import { UnsupportedVersionError } from './migrations';

export type SqlMigrations = readonly string[];

function readPragma(db: DatabaseSync, name: string): number {
  const row = db.prepare(`PRAGMA ${name}`).get();
  const value = row?.[name];
  if (typeof value !== 'number') throw new Error(`PRAGMA ${name} did not return a number`);
  return value;
}

export function readUserVersion(db: DatabaseSync): number {
  return readPragma(db, 'user_version');
}

export function readApplicationId(db: DatabaseSync): number {
  return readPragma(db, 'application_id');
}

export function migrateDatabase(db: DatabaseSync, migrations: SqlMigrations): void {
  const target = migrations.length;
  let current = readUserVersion(db);
  if (current > target) throw new UnsupportedVersionError(current);
  if (current === target) return;

  db.exec('BEGIN');
  try {
    for (const sql of migrations.slice(current)) {
      db.exec(sql);
      current += 1;
      db.exec(`PRAGMA user_version = ${current}`);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
