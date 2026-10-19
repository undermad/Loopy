import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { frontmatterEnd, rewriteLinks, type NoteLinkKind } from '@shared/markdown';
import {
  noteImportSchema,
  noteInputSchema,
  noteListSchema,
  notePatchSchema,
  noteSchema,
  noteVersionListSchema,
  sanitiseNoteTitle,
  uniqueNoteTitle,
  type Note,
  type NoteVersion,
} from '@shared/notes';
import { assertFolderScope } from './assets-repository';
import { transaction } from './tickets-repository';

const NOTE_COLUMNS =
  'id, folder_id AS folderId, title, body, starred, created_at AS createdAt, updated_at AS updatedAt';

function now(): string {
  return new Date().toISOString();
}

function noteRow(row: unknown): Note {
  const record = row as Record<string, unknown>;
  return noteSchema.parse({ ...record, starred: record['starred'] === 1 });
}

function readNote(db: DatabaseSync, id: string): Note {
  const row = db.prepare(`SELECT ${NOTE_COLUMNS} FROM notes WHERE id = ?`).get(id);
  if (!row) throw new Error(`Unknown note ${id}`);
  return noteRow(row);
}

export const VERSION_INTERVAL_MS = 5 * 60 * 1000;
export const VERSION_LIMIT = 50;

const VERSION_COLUMNS = 'id, note_id AS noteId, title, body, created_at AS createdAt';

function snapshot(db: DatabaseSync, note: Note, force = false): void {
  const latest = db
    .prepare(
      'SELECT created_at AS createdAt, body, title FROM note_versions WHERE note_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1',
    )
    .get(note.id) as { createdAt: string; body: string; title: string } | undefined;
  if (latest?.body === note.body && latest.title === note.title) return;
  const age = latest ? Date.now() - Date.parse(latest.createdAt) : Number.POSITIVE_INFINITY;
  if (!force && age < VERSION_INTERVAL_MS) return;
  db.prepare('INSERT INTO note_versions (id, note_id, title, body, created_at) VALUES (?, ?, ?, ?, ?)').run(
    randomUUID(),
    note.id,
    note.title,
    note.body,
    now(),
  );
  db.prepare(
    `DELETE FROM note_versions WHERE note_id = ? AND id NOT IN (
      SELECT id FROM note_versions WHERE note_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?)`,
  ).run(note.id, note.id, VERSION_LIMIT);
}

export function listNoteVersions(db: DatabaseSync, noteId: string): NoteVersion[] {
  readNote(db, noteId);
  return noteVersionListSchema.parse(
    db
      .prepare(
        `SELECT ${VERSION_COLUMNS} FROM note_versions WHERE note_id = ? ORDER BY created_at DESC, rowid DESC`,
      )
      .all(noteId),
  );
}

export function restoreNoteVersion(db: DatabaseSync, versionId: string): Note[] {
  return transaction(db, () => {
    const version = db.prepare(`SELECT ${VERSION_COLUMNS} FROM note_versions WHERE id = ?`).get(versionId) as
      NoteVersion | undefined;
    if (!version) throw new Error(`Unknown note version ${versionId}`);
    const current = readNote(db, version.noteId);
    snapshot(db, current, true);
    db.prepare('UPDATE notes SET body = ?, updated_at = ? WHERE id = ?').run(version.body, now(), current.id);
    return [readNote(db, current.id)];
  });
}

export function mergeNotes(db: DatabaseSync, sourceId: string, targetId: string): Note[] {
  if (sourceId === targetId) throw new Error('A note cannot be merged into itself');
  return transaction(db, () => {
    const source = readNote(db, sourceId);
    const target = readNote(db, targetId);
    snapshot(db, target, true);
    const content = source.body.slice(frontmatterEnd(source.body)).trim();
    const body = content.length === 0 ? target.body : `${target.body.trimEnd()}\n\n${content}\n`;
    db.prepare('UPDATE notes SET body = ?, updated_at = ? WHERE id = ?').run(body, now(), target.id);
    db.prepare('DELETE FROM notes WHERE id = ?').run(source.id);
    rewriteNoteLinks(db, 'note', source.title, target.title);
    return listNotes(db);
  });
}

function titles(db: DatabaseSync, except: string | null = null): string[] {
  return (db.prepare('SELECT id, title FROM notes').all() as { id: string; title: string }[])
    .filter((row) => row.id !== except)
    .map((row) => row.title);
}

export function listNotes(db: DatabaseSync): Note[] {
  return noteListSchema.parse(
    db.prepare(`SELECT ${NOTE_COLUMNS} FROM notes ORDER BY title COLLATE NOCASE, id`).all().map(noteRow),
  );
}

function insertNote(db: DatabaseSync, title: string, body: string, folderId: string | null): string {
  const id = randomUUID();
  const stamp = now();
  db.prepare(
    'INSERT INTO notes (id, folder_id, title, body, starred, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
  ).run(id, folderId, uniqueNoteTitle(title, titles(db)), body, stamp, stamp);
  return id;
}

export function createNote(db: DatabaseSync, raw: unknown): Note {
  const input = noteInputSchema.parse(raw);
  return transaction(db, () => {
    assertFolderScope(db, input.folderId, 'notes');
    return readNote(db, insertNote(db, input.title, input.body, input.folderId));
  });
}

export function rewriteNoteLinks(db: DatabaseSync, kind: NoteLinkKind, from: string, to: string): string[] {
  if (from === to || from.trim().length === 0) return [];
  const rows = db
    .prepare('SELECT id, body FROM notes WHERE instr(lower(body), lower(?)) > 0')
    .all(from.trim()) as {
    id: string;
    body: string;
  }[];
  const update = db.prepare('UPDATE notes SET body = ?, updated_at = ? WHERE id = ?');
  const changed: string[] = [];
  const stamp = now();
  for (const row of rows) {
    const body = rewriteLinks(row.body, kind, from, to);
    if (body === row.body) continue;
    snapshot(db, readNote(db, row.id));
    update.run(body, stamp, row.id);
    changed.push(row.id);
  }
  return changed;
}

const NAMED_TABLES = { board: 'boards', palette: 'palettes', asset: 'assets', card: 'cards' } as const;

export function trackRename<T>(
  db: DatabaseSync,
  kind: keyof typeof NAMED_TABLES,
  id: string,
  run: () => T,
): T {
  const read = db.prepare(`SELECT name FROM ${NAMED_TABLES[kind]} WHERE id = ?`);
  const before = (read.get(id) as { name: string } | undefined)?.name ?? null;
  const result = run();
  const after = (read.get(id) as { name: string } | undefined)?.name ?? null;
  if (before !== null && after !== null && before !== after) rewriteNoteLinks(db, kind, before, after);
  return result;
}

export function updateNote(db: DatabaseSync, id: string, raw: unknown): Note[] {
  const patch = notePatchSchema.parse(raw);
  return transaction(db, () => {
    const current = readNote(db, id);
    const renaming = patch.title !== undefined && patch.title !== current.title;
    if (renaming || (patch.body !== undefined && patch.body !== current.body))
      snapshot(db, current, renaming);
    const sets = ['updated_at = ?'];
    const values: (string | number | null)[] = [now()];
    let renamed: string | null = null;
    if (patch.title !== undefined && patch.title !== current.title) {
      const taken = new Set(titles(db, id).map((title) => title.toLowerCase()));
      if (taken.has(patch.title.toLowerCase()))
        throw new Error(`A note called ${patch.title} already exists`);
      sets.push('title = ?');
      values.push(patch.title);
      renamed = patch.title;
    }
    if (patch.body !== undefined) {
      sets.push('body = ?');
      values.push(patch.body);
    }
    if (patch.folderId !== undefined) {
      assertFolderScope(db, patch.folderId, 'notes');
      sets.push('folder_id = ?');
      values.push(patch.folderId);
    }
    if (patch.starred !== undefined) {
      sets.push('starred = ?');
      values.push(patch.starred ? 1 : 0);
    }
    db.prepare(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?`).run(...values, id);
    const changed = renamed === null ? [] : rewriteNoteLinks(db, 'note', current.title, renamed);
    return [id, ...changed.filter((other) => other !== id)].map((noteId) => readNote(db, noteId));
  });
}

export function deleteNotes(db: DatabaseSync, ids: string[]): Note[] {
  return transaction(db, () => {
    const remove = db.prepare('DELETE FROM notes WHERE id = ?');
    for (const id of ids) remove.run(id);
    return listNotes(db);
  });
}

function ensureFolder(
  db: DatabaseSync,
  cache: Map<string, string>,
  parentId: string | null,
  name: string,
): string {
  const key = `${parentId ?? ''}/${name.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const row = db
    .prepare(
      "SELECT id FROM asset_folders WHERE scope = 'notes' AND parent_id IS ? AND name = ? COLLATE NOCASE",
    )
    .get(parentId, name) as { id: string } | undefined;
  let id = row?.id;
  if (!id) {
    id = randomUUID();
    const stamp = now();
    db.prepare(
      "INSERT INTO asset_folders (id, parent_id, scope, name, created_at, updated_at) VALUES (?, ?, 'notes', ?, ?, ?)",
    ).run(id, parentId, name.slice(0, 80), stamp, stamp);
  }
  cache.set(key, id);
  return id;
}

export interface ImportedNotes {
  notes: Note[];
  ids: string[];
}

export function importNotes(db: DatabaseSync, raw: unknown): ImportedNotes {
  const input = noteImportSchema.parse(raw);
  return transaction(db, () => {
    assertFolderScope(db, input.folderId, 'notes');
    const folders = new Map<string, string>();
    const ids: string[] = [];
    for (const file of input.files) {
      const segments = file.path.split(/[\\/]+/).filter((segment) => segment.length > 0 && segment !== '.');
      const name = segments.pop() ?? 'Untitled.md';
      let folderId = input.folderId;
      for (const segment of segments) {
        const folderName = segment.trim();
        if (folderName.length === 0 || folderName.startsWith('.')) continue;
        folderId = ensureFolder(db, folders, folderId, folderName);
      }
      ids.push(insertNote(db, sanitiseNoteTitle(name), file.body, folderId));
    }
    return { notes: listNotes(db), ids };
  });
}

export function readNotes(db: DatabaseSync, ids: string[]): Note[] {
  return ids.map((id) => readNote(db, id));
}
