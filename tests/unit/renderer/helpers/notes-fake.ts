import { vi } from 'vitest';
import type { LoopyApi } from '@shared/ipc';
import { rewriteLinks } from '@shared/markdown';
import {
  noteImportSchema,
  noteInputSchema,
  notePatchSchema,
  sanitiseNoteTitle,
  uniqueNoteTitle,
  type Note,
  type NoteVersion,
} from '@shared/notes';

export type NotesFakeApi = Pick<
  LoopyApi,
  | 'listNotes'
  | 'createNote'
  | 'updateNote'
  | 'deleteNotes'
  | 'importNotes'
  | 'pickNotes'
  | 'exportNotes'
  | 'mergeNotes'
  | 'listNoteVersions'
  | 'restoreNoteVersion'
>;

export function createNotesFake() {
  const data = {
    notes: [] as Note[],
    versions: [] as NoteVersion[],
    counter: 0,
    stamp: '2026-10-17T09:00:00.000Z',
  };
  const remember = (note: Note) => {
    data.counter += 1;
    data.versions.unshift({
      id: `version-${String(data.counter)}`,
      noteId: note.id,
      title: note.title,
      body: note.body,
      createdAt: data.stamp,
    });
  };
  const nextId = () => {
    data.counter += 1;
    return `note-${String(data.counter)}`;
  };
  const find = (id: string): Note => {
    const note = data.notes.find((item) => item.id === id);
    if (!note) throw new Error(`Unknown note ${id}`);
    return note;
  };
  const insert = (title: string, body: string, folderId: string | null): Note => {
    const note: Note = {
      id: nextId(),
      folderId,
      title: uniqueNoteTitle(
        title,
        data.notes.map((item) => item.title),
      ),
      body,
      starred: false,
      createdAt: data.stamp,
      updatedAt: data.stamp,
    };
    data.notes.push(note);
    return note;
  };
  const list = () => structuredClone([...data.notes].sort((a, b) => a.title.localeCompare(b.title)));

  const api: NotesFakeApi = {
    listNotes: vi.fn(() => Promise.resolve(list())),
    createNote: vi.fn((raw: unknown) => {
      const input = noteInputSchema.parse(raw);
      return Promise.resolve(structuredClone(insert(input.title, input.body, input.folderId)));
    }),
    updateNote: vi.fn((id: string, raw: unknown) => {
      const patch = notePatchSchema.parse(raw);
      const note = find(id);
      const changed = [note];
      if (patch.title !== undefined && patch.title !== note.title) {
        const wanted = patch.title;
        if (data.notes.some((item) => item.id !== id && item.title.toLowerCase() === wanted.toLowerCase())) {
          return Promise.reject(new Error(`A note called ${wanted} already exists`));
        }
        for (const other of data.notes) {
          if (other.id === id) continue;
          const body = rewriteLinks(other.body, 'note', note.title, wanted);
          if (body !== other.body) {
            other.body = body;
            changed.push(other);
          }
        }
        note.title = wanted;
      }
      if (patch.body !== undefined && patch.body !== note.body) {
        remember(note);
        note.body = patch.body;
      }
      if (patch.folderId !== undefined) note.folderId = patch.folderId;
      if (patch.starred !== undefined) note.starred = patch.starred;
      return Promise.resolve(structuredClone(changed));
    }),
    deleteNotes: vi.fn((ids: string[]) => {
      data.notes = data.notes.filter((note) => !ids.includes(note.id));
      return Promise.resolve(list());
    }),
    importNotes: vi.fn((raw: unknown) => {
      const input = noteImportSchema.parse(raw);
      const ids = input.files.map(
        (file) => insert(sanitiseNoteTitle(file.path.split('/').pop() ?? ''), file.body, input.folderId).id,
      );
      return Promise.resolve({ status: 'imported' as const, notes: list(), ids });
    }),
    pickNotes: vi.fn(() => Promise.resolve({ status: 'cancelled' as const })),
    exportNotes: vi.fn(() => Promise.resolve({ status: 'exported' as const })),
    mergeNotes: vi.fn((sourceId: string, targetId: string) => {
      const source = find(sourceId);
      const target = find(targetId);
      remember(target);
      target.body = `${target.body.trimEnd()}\n\n${source.body.trim()}\n`;
      data.notes = data.notes.filter((note) => note.id !== sourceId);
      for (const note of data.notes) note.body = rewriteLinks(note.body, 'note', source.title, target.title);
      return Promise.resolve(list());
    }),
    listNoteVersions: vi.fn((noteId: string) =>
      Promise.resolve(structuredClone(data.versions.filter((version) => version.noteId === noteId))),
    ),
    restoreNoteVersion: vi.fn((versionId: string) => {
      const version = data.versions.find((item) => item.id === versionId);
      if (!version) return Promise.reject(new Error(`Unknown note version ${versionId}`));
      const note = find(version.noteId);
      remember(note);
      note.body = version.body;
      return Promise.resolve(structuredClone([note]));
    }),
  };
  return { api, data };
}
