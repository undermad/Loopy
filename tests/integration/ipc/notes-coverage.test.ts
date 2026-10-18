import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssetsSnapshot } from '@shared/assets';
import type { Board } from '@shared/board';
import { IpcChannel } from '@shared/ipc';
import type { Note, NoteImportResult, NoteVersion } from '@shared/notes';
import { registerAssetsHandlers } from '../../../src/main/ipc/assets';
import { registerBoardsHandlers } from '../../../src/main/ipc/boards';
import { registerNotesHandlers } from '../../../src/main/ipc/notes';
import { createProject, type ProjectDatabase } from '../../../src/main/storage';
import { rewriteNoteLinks, trackRename } from '../../../src/main/storage/notes-repository';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

let directory: string;
let project: ProjectDatabase;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-notes-cov-'));
  project = await createProject(join(directory, 'demo.loopy'), 'Demo');
});

afterEach(async () => {
  project.close();
  await rm(directory, { recursive: true, force: true });
});

function setup() {
  const handlers = new Map<string, Handler>();
  const ipc = { handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler)) };
  const dialogs = {
    showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] as string[] })),
    showSaveDialog: vi.fn(() =>
      Promise.resolve({ canceled: true } as { canceled: boolean; filePath?: string }),
    ),
  };
  const deps = { project: () => project, dialogs };
  registerNotesHandlers(ipc, deps);
  registerBoardsHandlers(ipc, deps);
  registerAssetsHandlers(ipc, deps);
  const call = <T>(channel: string, ...args: unknown[]) =>
    Promise.resolve().then(() => handlers.get(channel)?.({}, ...args)) as Promise<T>;
  return { call, dialogs };
}

function insertFolder(id: string, name: string, parentId: string | null): void {
  project.db
    .prepare(
      "INSERT INTO asset_folders (id, parent_id, scope, name, created_at, updated_at) VALUES (?, ?, 'notes', ?, '2026-10-18T09:00:00.000Z', '2026-10-18T09:00:00.000Z')",
    )
    .run(id, parentId, name);
}

describe('notes IPC picking', () => {
  it('imports picked markdown files by name', async () => {
    const { call, dialogs } = setup();
    const source = join(directory, 'source');
    await mkdir(join(source, 'deep'), { recursive: true });
    await writeFile(join(source, 'deep', 'Alpha.md'), 'Links [[Deep/Beta]] and [[board:Map]]');
    await writeFile(join(source, 'Beta.md'), 'Beta body');
    dialogs.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [join(source, 'deep', 'Alpha.md'), join(source, 'Beta.md')],
    });

    const result = await call<NoteImportResult>(IpcChannel.notesPick, 'files', undefined);
    expect(dialogs.showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({ properties: ['openFile', 'multiSelections'] }),
    );
    if (result.status !== 'imported') throw new Error('expected an import');
    expect(result.notes.map((note) => [note.title, note.body, note.folderId])).toEqual([
      ['Alpha', 'Links [[Beta]] and [[board:Map]]', null],
      ['Beta', 'Beta body', null],
    ]);
  });

  it('cancels when the dialog is cancelled or returns no paths', async () => {
    const { call, dialogs } = setup();
    await expect(call(IpcChannel.notesPick, 'files', null)).resolves.toEqual({ status: 'cancelled' });
    dialogs.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [] });
    await expect(call(IpcChannel.notesPick, 'folder', null)).resolves.toEqual({ status: 'cancelled' });
    await expect(call(IpcChannel.notesPick, 'everything', null)).rejects.toThrow();
  });

  it('cancels a folder pick that holds no markdown', async () => {
    const { call, dialogs } = setup();
    const folder = join(directory, 'empty vault');
    await mkdir(join(folder, 'nested'), { recursive: true });
    await writeFile(join(folder, 'nested', 'readme.xyz'), 'nothing');
    await writeFile(join(folder, '.hidden.md'), 'hidden');
    dialogs.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [folder] });

    await expect(call(IpcChannel.notesPick, 'folder', null)).resolves.toEqual({ status: 'cancelled' });
    expect(dialogs.showOpenDialog).toHaveBeenCalledWith({ properties: ['openDirectory'] });
    await expect(call<Note[]>(IpcChannel.notesList)).resolves.toEqual([]);
  });

  it('imports a picked folder into a chosen note folder', async () => {
    const { call, dialogs } = setup();
    const snapshot = await call<AssetsSnapshot>(IpcChannel.assetsCreateFolder, {
      name: 'Inbox',
      scope: 'notes',
    });
    const inbox = snapshot.folders.find((item) => item.name === 'Inbox');
    const vault = join(directory, 'Vault');
    await mkdir(vault, { recursive: true });
    await writeFile(join(vault, 'Only.md'), '[[Only]]');
    dialogs.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [vault] });

    const result = await call<NoteImportResult>(IpcChannel.notesPick, 'folder', inbox?.id);
    if (result.status !== 'imported') throw new Error('expected an import');
    const assets = await call<AssetsSnapshot>(IpcChannel.assetsSnapshot);
    const created = assets.folders.find((item) => item.name === 'Vault');
    expect(created?.parentId).toBe(inbox?.id);
    expect(result.notes[0]).toMatchObject({ title: 'Only', body: '[[Only]]', folderId: created?.id });
  });
});

describe('notes IPC exporting', () => {
  it('cancels a multi-note export from the folder dialog', async () => {
    const { call, dialogs } = setup();
    const one = await call<Note>(IpcChannel.notesCreate, { title: 'One' });
    const two = await call<Note>(IpcChannel.notesCreate, { title: 'Two' });
    await expect(call(IpcChannel.notesExport, { ids: [one.id, two.id] })).resolves.toEqual({
      status: 'cancelled',
    });
    dialogs.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [] });
    await expect(call(IpcChannel.notesExport, { ids: [one.id, two.id] })).resolves.toEqual({
      status: 'cancelled',
    });
    expect(dialogs.showOpenDialog).toHaveBeenCalledWith({ properties: ['openDirectory', 'createDirectory'] });
  });

  it('cancels a single export when the save dialog has no path', async () => {
    const { call, dialogs } = setup();
    const one = await call<Note>(IpcChannel.notesCreate, { title: 'One' });
    dialogs.showSaveDialog.mockResolvedValueOnce({ canceled: false });
    await expect(call(IpcChannel.notesExport, { ids: [one.id] })).resolves.toEqual({ status: 'cancelled' });
    expect(dialogs.showSaveDialog).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: 'One.md' }));
  });

  it('writes plain links without attachments when no asset matches', async () => {
    const { call, dialogs } = setup();
    const note = await call<Note>(IpcChannel.notesCreate, {
      title: 'Plain',
      body: '[[asset:missing file.png|art]] ![[asset:a:b.png]] [[ticket:12]] [[palette:Warm|warm tones]]',
    });
    const file = join(directory, 'plain', 'Plain.md');
    dialogs.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: file });
    await call(IpcChannel.notesExport, { ids: [note.id], loopyLinks: 'plain' });
    expect(await readFile(file, 'utf8')).toBe(
      '[art](attachments/missing%20file.png) ![a:b.png](attachments/a_b.png) 12 warm tones',
    );
    expect(await readdir(join(directory, 'plain'))).toEqual(['Plain.md']);
  });

  it('exports notes inside nested folders with safe folder names', async () => {
    const { call, dialogs } = setup();
    insertFolder('top', '..', null);
    insertFolder('mid', 'a:b', 'top');
    insertFolder('loop-a', 'Loop', null);
    insertFolder('loop-b', 'Back', 'loop-a');
    project.db.prepare("UPDATE asset_folders SET parent_id = 'loop-b' WHERE id = 'loop-a'").run();
    const deep = await call<Note>(IpcChannel.notesCreate, { title: 'Deep', body: 'deep', folderId: 'mid' });
    const looped = await call<Note>(IpcChannel.notesCreate, {
      title: 'Looped',
      body: 'looped',
      folderId: 'loop-a',
    });
    const out = join(directory, 'nested');
    dialogs.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [out] });

    await call(IpcChannel.notesExport, { ids: [deep.id, looped.id] });
    expect(await readFile(join(out, '_', 'a_b', 'Deep.md'), 'utf8')).toBe('deep');
    expect(await readFile(join(out, 'Back', 'Loop', 'Looped.md'), 'utf8')).toBe('looped');
  });

  it('rejects export of unknown notes', async () => {
    const { call } = setup();
    await expect(call(IpcChannel.notesExport, { ids: ['missing'] })).rejects.toThrow(/Unknown note/);
  });
});

describe('notes repository edges', () => {
  it('ignores unknown ids when deleting', async () => {
    const { call } = setup();
    const kept = await call<Note>(IpcChannel.notesCreate, { title: 'Kept' });
    const notes = await call<Note[]>(IpcChannel.notesDelete, ['missing', 'other']);
    expect(notes.map((note) => note.id)).toEqual([kept.id]);
    await expect(call(IpcChannel.notesDelete, [])).rejects.toThrow();
  });

  it('refuses to create a note in a folder of another scope', async () => {
    const { call } = setup();
    const snapshot = await call<AssetsSnapshot>(IpcChannel.assetsCreateFolder, {
      name: 'Maps',
      scope: 'boards',
    });
    const maps = snapshot.folders.find((item) => item.name === 'Maps');
    await expect(call(IpcChannel.notesCreate, { title: 'Wrong', folderId: maps?.id })).rejects.toThrow(
      /does not hold/,
    );
    await expect(call(IpcChannel.notesList)).resolves.toEqual([]);
  });

  it('only rewrites links when a tracked name really changes', async () => {
    const { call } = setup();
    const board = await call<Board>(IpcChannel.boardsCreate, { name: 'Level' });
    const note = await call<Note>(IpcChannel.notesCreate, { title: 'Plan', body: '[[board:Level]]' });

    expect(trackRename(project.db, 'board', board.id, () => 'same')).toBe('same');
    trackRename(project.db, 'board', 'missing', () => undefined);
    trackRename(project.db, 'board', board.id, () => {
      project.db.prepare('DELETE FROM boards WHERE id = ?').run(board.id);
    });
    const [unchanged] = await call<Note[]>(IpcChannel.notesList);
    expect(unchanged?.body).toBe('[[board:Level]]');
    expect(unchanged?.id).toBe(note.id);
    expect(rewriteNoteLinks(project.db, 'board', '  ', 'Other')).toEqual([]);
    expect(rewriteNoteLinks(project.db, 'board', 'Level', 'Level')).toEqual([]);
  });

  it('keeps the target body when the merged source is empty', async () => {
    const { call } = setup();
    const target = await call<Note>(IpcChannel.notesCreate, { title: 'Target', body: 'Keep me  ' });
    const source = await call<Note>(IpcChannel.notesCreate, {
      title: 'Source',
      body: '---\ntags: [x]\n---\n  ',
    });
    const notes = await call<Note[]>(IpcChannel.notesMerge, source.id, target.id);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.body).toBe('Keep me  ');
    await expect(call(IpcChannel.notesMerge, 'missing', target.id)).rejects.toThrow(/Unknown note/);
  });

  it('restores a version and snapshots the current body first', async () => {
    const { call } = setup();
    const note = await call<Note>(IpcChannel.notesCreate, { title: 'Draft', body: 'one' });
    await call(IpcChannel.notesUpdate, note.id, { title: 'Final' });
    await call(IpcChannel.notesUpdate, note.id, { body: 'two' });
    const versions = await call<NoteVersion[]>(IpcChannel.noteVersionsList, note.id);
    expect(versions.map((version) => [version.title, version.body])).toEqual([['Draft', 'one']]);

    const [restored] = await call<Note[]>(IpcChannel.noteVersionsRestore, versions[0]?.id);
    expect(restored).toMatchObject({ title: 'Final', body: 'one' });
    const after = await call<NoteVersion[]>(IpcChannel.noteVersionsList, note.id);
    expect(after.map((version) => version.body)).toEqual(['two', 'one']);

    const [again] = await call<Note[]>(IpcChannel.noteVersionsRestore, after[1]?.id);
    expect(again?.body).toBe('one');
    const unchanged = await call<NoteVersion[]>(IpcChannel.noteVersionsList, note.id);
    expect(unchanged).toHaveLength(3);

    await call(IpcChannel.noteVersionsRestore, after[1]?.id);
    await expect(call<NoteVersion[]>(IpcChannel.noteVersionsList, note.id)).resolves.toHaveLength(3);
  });

  it('leaves notes untouched when a rename changes nothing', async () => {
    const { call } = setup();
    const note = await call<Note>(IpcChannel.notesCreate, { title: 'Same', body: 'body' });
    const [same] = await call<Note[]>(IpcChannel.notesUpdate, note.id, { title: 'Same', body: 'body' });
    expect(same).toMatchObject({ title: 'Same', body: 'body' });
    await expect(call(IpcChannel.noteVersionsList, note.id)).resolves.toEqual([]);
  });

  it('imports files with empty and dotted path segments', async () => {
    const { call } = setup();
    const result = await call<NoteImportResult>(IpcChannel.notesImport, {
      files: [
        { path: './Vault//.hidden/ /Note.md', body: 'a' },
        { path: 'Vault/Other.md', body: 'b' },
      ],
    });
    if (result.status !== 'imported') throw new Error('expected an import');
    const assets = await call<AssetsSnapshot>(IpcChannel.assetsSnapshot);
    const notesFolders = assets.folders.filter((folder) => folder.scope === 'notes');
    expect(notesFolders.map((folder) => folder.name)).toEqual(['Vault']);
    const vault = notesFolders[0]?.id;
    expect(result.notes.map((note) => note.folderId)).toEqual([vault, vault]);
  });
});
