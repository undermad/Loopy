import type { SqlMigrations } from './sql-migrations';

export const projectMigrations: SqlMigrations = [
  `CREATE TABLE project (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL CHECK (length(name) > 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  ) WITHOUT ROWID;`,
];

export const CURRENT_PROJECT_SCHEMA_VERSION = projectMigrations.length;
