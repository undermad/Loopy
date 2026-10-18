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
  `CREATE TABLE boards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(name) > 0),
    background_color TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE board_nodes (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    width REAL NOT NULL,
    height REAL NOT NULL,
    z INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX board_nodes_by_board ON board_nodes(board_id);
  CREATE TABLE board_edges (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES board_nodes(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES board_nodes(id) ON DELETE CASCADE,
    data TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX board_edges_by_board ON board_edges(board_id);
  CREATE TABLE assets (
    id TEXT PRIMARY KEY,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    bytes BLOB NOT NULL,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE ticket_labels_v4 AS SELECT ticket_id, label_id FROM ticket_labels;
  DROP TABLE ticket_labels;
  CREATE TABLE tickets_v4 (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL UNIQUE,
    title TEXT NOT NULL CHECK (length(title) > 0),
    description TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL CHECK (type IN ('task', 'spike', 'bug')),
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    state_id TEXT REFERENCES ticket_states(id) ON DELETE SET NULL,
    position TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    resolved_at TEXT
  );
  INSERT INTO tickets_v4 (id, number, title, description, type, priority, state_id, position, created_at, updated_at, resolved_at)
    SELECT id, number, title, description, CASE WHEN type = 'idea' THEN 'task' ELSE type END, priority, state_id, position,
      created_at, updated_at, resolved_at FROM tickets;
  DROP TABLE tickets;
  ALTER TABLE tickets_v4 RENAME TO tickets;
  CREATE INDEX tickets_by_state ON tickets(state_id, position);
  CREATE TABLE ticket_labels (
    ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (ticket_id, label_id)
  ) WITHOUT ROWID;
  INSERT INTO ticket_labels (ticket_id, label_id) SELECT ticket_id, label_id FROM ticket_labels_v4;
  DROP TABLE ticket_labels_v4;`,
  `ALTER TABLE boards ADD COLUMN unit TEXT NOT NULL DEFAULT 'm' CHECK (unit IN ('px', 'mm', 'cm', 'm', 'km'));
  ALTER TABLE boards ADD COLUMN unit_scale REAL NOT NULL DEFAULT 100 CHECK (unit_scale > 0);`,
  `ALTER TABLE boards ADD COLUMN grid_color TEXT NOT NULL DEFAULT '#808080';`,
  `CREATE TABLE sprints (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(name) > 0),
    goal TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('planned', 'active', 'completed')),
    position TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  ALTER TABLE tickets ADD COLUMN sprint_id TEXT REFERENCES sprints(id) ON DELETE SET NULL;
  ALTER TABLE tickets ADD COLUMN estimate REAL CHECK (estimate IS NULL OR estimate >= 0);
  ALTER TABLE tickets ADD COLUMN due_at TEXT;
  CREATE INDEX tickets_by_sprint ON tickets(sprint_id, position);
  CREATE TABLE ticket_comments (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK (length(body) > 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX ticket_comments_by_ticket ON ticket_comments(ticket_id, created_at);
  CREATE TABLE ticket_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(name) > 0),
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL CHECK (type IN ('task', 'spike', 'bug')),
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    estimate REAL CHECK (estimate IS NULL OR estimate >= 0),
    label_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE palettes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(name) > 0),
    harmony TEXT NOT NULL,
    base_index INTEGER NOT NULL DEFAULT 2,
    source TEXT NOT NULL DEFAULT 'wheel',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE palette_colours (
    id TEXT PRIMARY KEY,
    palette_id TEXT NOT NULL REFERENCES palettes(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    hex TEXT NOT NULL
  );
  CREATE INDEX palette_colours_by_palette ON palette_colours(palette_id, position);
  ALTER TABLE boards ADD COLUMN background_ref TEXT;
  ALTER TABLE boards ADD COLUMN grid_ref TEXT;
  CREATE TABLE asset_folders (
    id TEXT PRIMARY KEY,
    parent_id TEXT REFERENCES asset_folders(id) ON DELETE SET NULL,
    name TEXT NOT NULL CHECK (length(name) > 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX asset_folders_by_parent ON asset_folders(parent_id);
  ALTER TABLE assets ADD COLUMN folder_id TEXT REFERENCES asset_folders(id) ON DELETE SET NULL;
  ALTER TABLE assets ADD COLUMN name TEXT NOT NULL DEFAULT 'asset';
  ALTER TABLE assets ADD COLUMN kind TEXT NOT NULL DEFAULT 'other';
  ALTER TABLE assets ADD COLUMN width INTEGER;
  ALTER TABLE assets ADD COLUMN height INTEGER;
  ALTER TABLE assets ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
  ALTER TABLE assets ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
  UPDATE assets SET updated_at = created_at WHERE updated_at = '';
  CREATE INDEX assets_by_folder ON assets(folder_id, name);
  INSERT INTO asset_folders (id, parent_id, name, created_at, updated_at) VALUES
    ('folder-images', NULL, 'Images', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
    ('folder-audio', NULL, 'Audio', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
    ('folder-video', NULL, 'Video', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
    ('folder-documents', NULL, 'Documents', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
    ('folder-fonts', NULL, 'Fonts', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
    ('folder-models', NULL, 'Models', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
    ('folder-archives', NULL, 'Archives', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');`,
  `CREATE TABLE palette_clusters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(name) > 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  ALTER TABLE palettes ADD COLUMN cluster_id TEXT REFERENCES palette_clusters(id) ON DELETE SET NULL;
  ALTER TABLE palettes ADD COLUMN cluster_position INTEGER NOT NULL DEFAULT 0;
  CREATE INDEX palettes_by_cluster ON palettes(cluster_id, cluster_position);`,
  `ALTER TABLE board_nodes ADD COLUMN parent_id TEXT REFERENCES board_nodes(id) ON DELETE CASCADE;
  CREATE INDEX board_nodes_by_parent ON board_nodes(parent_id);
  UPDATE board_nodes SET type = 'text', data = json_object(
    'text', COALESCE(json_extract(data, '$.text'), ''),
    'style', json_object(
      'fill', json(COALESCE(json_extract(data, '$.fill'), '{"hex":"#fde68a","ref":null}')),
      'shadow', json('true'),
      'padding', 12,
      'radius', 4
    )
  ) WHERE type = 'note';
  CREATE TABLE card_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(name) > 0),
    data TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `ALTER TABLE asset_folders ADD COLUMN scope TEXT NOT NULL DEFAULT 'files' CHECK (scope IN ('files', 'boards', 'palettes'));
  ALTER TABLE boards ADD COLUMN folder_id TEXT REFERENCES asset_folders(id) ON DELETE SET NULL;
  ALTER TABLE palettes ADD COLUMN folder_id TEXT REFERENCES asset_folders(id) ON DELETE SET NULL;`,
  `ALTER TABLE tickets ADD COLUMN links TEXT NOT NULL DEFAULT '[]';`,
  `CREATE TEMP TABLE folder_parents_notes AS SELECT id, parent_id FROM asset_folders;
  CREATE TEMP TABLE folder_refs_notes AS
    SELECT 'assets' AS owner, id, folder_id FROM assets WHERE folder_id IS NOT NULL
    UNION ALL SELECT 'boards', id, folder_id FROM boards WHERE folder_id IS NOT NULL
    UNION ALL SELECT 'palettes', id, folder_id FROM palettes WHERE folder_id IS NOT NULL;
  CREATE TABLE asset_folders_notes (
    id TEXT PRIMARY KEY,
    parent_id TEXT REFERENCES asset_folders(id) ON DELETE SET NULL,
    name TEXT NOT NULL CHECK (length(name) > 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'files' CHECK (scope IN ('files', 'boards', 'palettes', 'notes'))
  );
  INSERT INTO asset_folders_notes (id, parent_id, name, created_at, updated_at, scope)
    SELECT id, NULL, name, created_at, updated_at, scope FROM asset_folders;
  DROP TABLE asset_folders;
  ALTER TABLE asset_folders_notes RENAME TO asset_folders;
  CREATE INDEX asset_folders_by_parent ON asset_folders(parent_id);
  UPDATE asset_folders SET parent_id = (SELECT parent_id FROM folder_parents_notes p WHERE p.id = asset_folders.id);
  UPDATE assets SET folder_id = (SELECT folder_id FROM folder_refs_notes r WHERE r.owner = 'assets' AND r.id = assets.id)
    WHERE id IN (SELECT id FROM folder_refs_notes WHERE owner = 'assets');
  UPDATE boards SET folder_id = (SELECT folder_id FROM folder_refs_notes r WHERE r.owner = 'boards' AND r.id = boards.id)
    WHERE id IN (SELECT id FROM folder_refs_notes WHERE owner = 'boards');
  UPDATE palettes SET folder_id = (SELECT folder_id FROM folder_refs_notes r WHERE r.owner = 'palettes' AND r.id = palettes.id)
    WHERE id IN (SELECT id FROM folder_refs_notes WHERE owner = 'palettes');
  DROP TABLE folder_parents_notes;
  DROP TABLE folder_refs_notes;
  CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    folder_id TEXT REFERENCES asset_folders(id) ON DELETE SET NULL,
    title TEXT NOT NULL CHECK (length(title) > 0),
    body TEXT NOT NULL DEFAULT '',
    starred INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX notes_by_title ON notes(title COLLATE NOCASE);
  CREATE INDEX notes_by_folder ON notes(folder_id);`,
  `CREATE TABLE note_versions (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX note_versions_by_note ON note_versions(note_id, created_at);`,
];

export const CURRENT_PROJECT_SCHEMA_VERSION = projectMigrations.length;
