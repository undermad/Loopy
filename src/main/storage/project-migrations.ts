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
  `CREATE TABLE ticket_states (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(name) > 0),
    position TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('todo', 'doing', 'done')),
    color TEXT NOT NULL
  );
  CREATE TABLE tickets (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL UNIQUE,
    title TEXT NOT NULL CHECK (length(title) > 0),
    description TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL CHECK (type IN ('task', 'bug', 'idea')),
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    state_id TEXT REFERENCES ticket_states(id) ON DELETE SET NULL,
    position TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    resolved_at TEXT
  );
  CREATE INDEX tickets_by_state ON tickets(state_id, position);
  CREATE TABLE labels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE CHECK (length(name) > 0),
    color TEXT NOT NULL
  );
  CREATE TABLE ticket_labels (
    ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (ticket_id, label_id)
  ) WITHOUT ROWID;
  INSERT INTO ticket_states (id, name, position, category, color) VALUES
    ('todo', 'To do', 'a', 'todo', '#64748b'),
    ('doing', 'In progress', 'i', 'doing', '#2563eb'),
    ('done', 'Done', 'r', 'done', '#16a34a');`,
];

export const CURRENT_PROJECT_SCHEMA_VERSION = projectMigrations.length;
