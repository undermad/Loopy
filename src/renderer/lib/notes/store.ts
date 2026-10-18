import { createStore } from 'zustand/vanilla';
import type { ExportResult, LoopyApi, NotePickMode } from '@shared/ipc';
import {
  uniqueNoteTitle,
  type Note,
  type NoteExport,
  type NoteInput,
  type NotePatch,
  type NoteVersion,
} from '@shared/notes';
import { subscribeCurrentProject } from '@renderer/lib/project';

export type NotesApi = Pick<
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

export interface NotesState {
  notes: Note[] | null;
  activeId: string | null;
  api: NotesApi | null;
}

export const notesStore = createStore<NotesState>(() => ({ notes: null, activeId: null, api: null }));

export const SAVE_DELAY = 400;

const pending = new Map<string, string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let loadToken = 0;

function requireApi(): NotesApi {
  const { api } = notesStore.getState();
  if (!api) throw new Error('Notes are not loaded');
  return api;
}

function merge(notes: Note[]): Note[] {
  return notes.map((note) => {
    const body = pending.get(note.id);
    return body === undefined ? note : { ...note, body };
  });
}

function store(changed: Note[]): void {
  loadToken += 1;
  const list = notesStore.getState().notes ?? [];
  const byId = new Map(changed.map((note) => [note.id, note]));
  const next = list.map((note) => byId.get(note.id) ?? note);
  for (const note of changed) if (!list.some((item) => item.id === note.id)) next.push(note);
  notesStore.setState({ notes: merge(next) });
}

function cancelSave(id: string): void {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
}

export async function loadNotes(): Promise<Note[]> {
  loadToken += 1;
  const token = loadToken;
  const notes = await requireApi().listNotes();
  if (token === loadToken) notesStore.setState({ notes: merge(notes) });
  return notes;
}

export async function flushNotes(): Promise<void> {
  const entries = [...pending.entries()];
  for (const [id] of entries) cancelSave(id);
  pending.clear();
  const api = notesStore.getState().api;
  if (!api) return;
  await Promise.all(entries.map(([id, body]) => api.updateNote(id, { body }).then(store, () => undefined)));
}

export async function bootNotes(api: NotesApi, hasProject: boolean): Promise<void> {
  notesStore.setState({ api });
  if (hasProject) await loadNotes();
  subscribeCurrentProject((project) => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    pending.clear();
    notesStore.setState({ notes: null, activeId: null });
    if (project) void loadNotes();
  });
}

export function setActiveNote(id: string | null): void {
  if (notesStore.getState().activeId !== id) notesStore.setState({ activeId: id });
}

export function findNote(id: string | null): Note | null {
  return notesStore.getState().notes?.find((note) => note.id === id) ?? null;
}

export function nextNoteTitle(wanted: string): string {
  return uniqueNoteTitle(
    wanted,
    (notesStore.getState().notes ?? []).map((note) => note.title),
  );
}

export async function createNote(input: NoteInput): Promise<Note> {
  const note = await requireApi().createNote(input);
  store([note]);
  return note;
}

export function editNoteBody(id: string, body: string): void {
  const list = notesStore.getState().notes;
  if (!list) return;
  notesStore.setState({ notes: list.map((note) => (note.id === id ? { ...note, body } : note)) });
  pending.set(id, body);
  cancelSave(id);
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      const latest = pending.get(id);
      if (latest === undefined) return;
      pending.delete(id);
      void requireApi()
        .updateNote(id, { body: latest })
        .then(store, () => undefined);
    }, SAVE_DELAY),
  );
}

export async function updateNote(id: string, patch: NotePatch): Promise<Note[]> {
  const body = pending.get(id);
  const withBody = body !== undefined && patch.body === undefined ? { ...patch, body } : patch;
  pending.delete(id);
  cancelSave(id);
  const changed = await requireApi().updateNote(id, withBody);
  store(changed);
  return changed;
}

export async function deleteNotes(ids: string[]): Promise<Note[]> {
  for (const id of ids) {
    pending.delete(id);
    cancelSave(id);
  }
  const notes = await requireApi().deleteNotes(ids);
  loadToken += 1;
  const { activeId } = notesStore.getState();
  notesStore.setState({ notes, activeId: activeId && ids.includes(activeId) ? null : activeId });
  return notes;
}

export async function importNoteFiles(
  files: { path: string; body: string }[],
  folderId: string | null,
): Promise<string[]> {
  if (files.length === 0) return [];
  const result = await requireApi().importNotes({ files, folderId });
  if (result.status !== 'imported') return [];
  loadToken += 1;
  notesStore.setState({ notes: merge(result.notes) });
  return result.ids;
}

export async function pickNotes(mode: NotePickMode, folderId: string | null): Promise<string[]> {
  await flushNotes();
  const result = await requireApi().pickNotes(mode, folderId);
  if (result.status !== 'imported') return [];
  loadToken += 1;
  notesStore.setState({ notes: merge(result.notes) });
  return result.ids;
}

export async function exportNotes(input: NoteExport): Promise<ExportResult> {
  await flushNotes();
  return requireApi().exportNotes(input);
}

export async function mergeNotes(sourceId: string, targetId: string): Promise<Note[]> {
  await flushNotes();
  const notes = await requireApi().mergeNotes(sourceId, targetId);
  loadToken += 1;
  const { activeId } = notesStore.getState();
  notesStore.setState({ notes, activeId: activeId === sourceId ? targetId : activeId });
  return notes;
}

export async function listNoteVersions(noteId: string): Promise<NoteVersion[]> {
  await flushNotes();
  return requireApi().listNoteVersions(noteId);
}

export async function restoreNoteVersion(versionId: string): Promise<Note[]> {
  await flushNotes();
  const changed = await requireApi().restoreNoteVersion(versionId);
  store(changed);
  return changed;
}

export function resetNotesStore(): void {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  pending.clear();
  notesStore.setState({ notes: null, activeId: null, api: null });
}
