import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { IpcMain } from 'electron';
import { ASSET_MAX_BYTES, assetKindOf } from '@shared/assets';
import { IpcChannel, entityIdSchema, notePickModeSchema, type ExportResult } from '@shared/ipc';
import { formatLink, replaceLinks } from '@shared/markdown';
import { noteExportSchema, type Note, type NoteFile, type NoteImportResult } from '@shared/notes';
import { importAssets, readAssetBytes } from '../storage/assets-repository';
import {
  createNote,
  deleteNotes,
  importNotes,
  listNoteVersions,
  listNotes,
  mergeNotes,
  readNotes,
  restoreNoteVersion,
  updateNote,
} from '../storage/notes-repository';
import type { FileDialogs } from './themes';
import type { TicketsHandlerDeps } from './tickets';
import { NoProjectError } from './tickets';

export interface NotesHandlerDeps extends TicketsHandlerDeps {
  dialogs: FileDialogs;
}

const MARKDOWN = new Set(['.md', '.markdown']);
const ATTACHMENTS = 'attachments';
const markdownFilters = [{ name: 'Markdown', extensions: ['md', 'markdown'] }];

function safeSegment(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned === '' || cleaned === '.' || cleaned === '..' ? '_' : cleaned;
}

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function linkImportedBody(body: string, attachments: ReadonlySet<string>): string {
  return replaceLinks(body, (link) => {
    if (link.kind !== 'note') return null;
    const name = link.target.split('/').pop() ?? link.target;
    if (attachments.has(name.toLowerCase())) {
      return formatLink({ ...link, kind: 'asset', target: name }, link.embed);
    }
    return name === link.target ? null : formatLink({ ...link, target: name }, link.embed);
  });
}

function plainBody(body: string, onAsset: (name: string) => string): string {
  return replaceLinks(body, (link) => {
    if (link.kind === 'note') return null;
    const label = link.alias ?? link.target;
    if (link.kind === 'asset') {
      const path = encodeURI(onAsset(link.target));
      return link.embed ? `![${label}](${path})` : `[${label}](${path})`;
    }
    return label;
  });
}

function folderPath(db: DatabaseSync, folderId: string | null): string[] {
  const path: string[] = [];
  const seen = new Set<string>();
  let current = folderId;
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    const row = db
      .prepare('SELECT parent_id AS parentId, name FROM asset_folders WHERE id = ?')
      .get(current) as { parentId: string | null; name: string } | undefined;
    if (!row) break;
    path.unshift(safeSegment(row.name));
    current = row.parentId;
  }
  return path;
}

export function registerNotesHandlers(ipc: Pick<IpcMain, 'handle'>, deps: NotesHandlerDeps): void {
  const db = () => {
    const project = deps.project();
    if (!project) throw new NoProjectError();
    return project.db;
  };
  const id = (raw: unknown) => entityIdSchema.parse(raw);

  async function pick(rawMode: unknown, rawFolder: unknown): Promise<NoteImportResult> {
    const mode = notePickModeSchema.parse(rawMode);
    const folderId = entityIdSchema.nullable().parse(rawFolder ?? null);
    const database = db();
    const picked = await deps.dialogs.showOpenDialog(
      mode === 'folder'
        ? { properties: ['openDirectory'] }
        : { properties: ['openFile', 'multiSelections'], filters: markdownFilters },
    );
    if (picked.canceled || picked.filePaths.length === 0) return { status: 'cancelled' };
    const files: NoteFile[] = [];
    const attachments = new Set<string>();
    if (mode === 'folder') {
      const root = picked.filePaths[0] ?? '';
      const media: { name: string; bytes: Uint8Array }[] = [];
      for (const path of await walk(root)) {
        if (MARKDOWN.has(extname(path).toLowerCase())) {
          files.push({
            path: join(basename(root), relative(root, path)),
            body: await readFile(path, 'utf8'),
          });
        } else if (assetKindOf(path) !== 'other' && (await stat(path)).size <= ASSET_MAX_BYTES) {
          media.push({ name: basename(path), bytes: await readFile(path) });
          attachments.add(basename(path).toLowerCase());
        }
      }
      for (let start = 0; start < media.length; start += 500) {
        importAssets(database, { target: 'auto', files: media.slice(start, start + 500) });
      }
    } else {
      for (const path of picked.filePaths) {
        files.push({ path: basename(path), body: await readFile(path, 'utf8') });
      }
    }
    if (files.length === 0) return { status: 'cancelled' };
    const imported = importNotes(database, {
      folderId,
      files: files.map((file) => ({ ...file, body: linkImportedBody(file.body, attachments) })),
    });
    return { status: 'imported', notes: imported.notes, ids: imported.ids };
  }

  async function writeNote(database: DatabaseSync, note: Note, file: string, mode: 'keep' | 'plain') {
    const directory = dirname(file);
    let body = note.body;
    if (mode === 'plain') {
      const wanted = new Map<string, string>();
      body = plainBody(note.body, (name) => {
        const safe = safeSegment(name);
        wanted.set(name, safe);
        return `${ATTACHMENTS}/${safe}`;
      });
      for (const [name, safe] of wanted) {
        const row = database.prepare('SELECT id FROM assets WHERE name = ? COLLATE NOCASE').get(name) as
          { id: string } | undefined;
        const content = row ? readAssetBytes(database, row.id) : null;
        if (!content) continue;
        await mkdir(join(directory, ATTACHMENTS), { recursive: true });
        await writeFile(join(directory, ATTACHMENTS, safe), content.bytes);
      }
    }
    await mkdir(directory, { recursive: true });
    await writeFile(file, body, 'utf8');
  }

  async function exportNotes(raw: unknown): Promise<ExportResult> {
    const input = noteExportSchema.parse(raw);
    const database = db();
    const notes = readNotes(database, input.ids);
    const first = notes[0];
    if (notes.length === 1 && first) {
      const picked = await deps.dialogs.showSaveDialog({
        defaultPath: `${safeSegment(first.title)}.md`,
        filters: markdownFilters,
      });
      if (picked.canceled || !picked.filePath) return { status: 'cancelled' };
      await writeNote(database, first, picked.filePath, input.loopyLinks);
      return { status: 'exported' };
    }
    const picked = await deps.dialogs.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    const root = picked.filePaths[0];
    if (picked.canceled || !root) return { status: 'cancelled' };
    for (const note of notes) {
      const file = join(root, ...folderPath(database, note.folderId), `${safeSegment(note.title)}.md`);
      await writeNote(database, note, file, input.loopyLinks);
    }
    return { status: 'exported' };
  }

  ipc.handle(IpcChannel.notesList, () => listNotes(db()));
  ipc.handle(IpcChannel.notesCreate, (_event, input: unknown) => createNote(db(), input));
  ipc.handle(IpcChannel.notesUpdate, (_event, rawId: unknown, patch: unknown) =>
    updateNote(db(), id(rawId), patch),
  );
  ipc.handle(IpcChannel.notesDelete, (_event, ids: unknown) =>
    deleteNotes(db(), entityIdSchema.array().min(1).parse(ids)),
  );
  ipc.handle(IpcChannel.notesImport, (_event, input: unknown): NoteImportResult => {
    const imported = importNotes(db(), input);
    return { status: 'imported', notes: imported.notes, ids: imported.ids };
  });
  ipc.handle(IpcChannel.notesPick, (_event, mode: unknown, folderId: unknown) => pick(mode, folderId));
  ipc.handle(IpcChannel.notesExport, (_event, input: unknown) => exportNotes(input));
  ipc.handle(IpcChannel.notesMerge, (_event, sourceId: unknown, targetId: unknown) =>
    mergeNotes(db(), id(sourceId), id(targetId)),
  );
  ipc.handle(IpcChannel.noteVersionsList, (_event, noteId: unknown) => listNoteVersions(db(), id(noteId)));
  ipc.handle(IpcChannel.noteVersionsRestore, (_event, versionId: unknown) =>
    restoreNoteVersion(db(), id(versionId)),
  );
}
