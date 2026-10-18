import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

type Handler = (event: unknown, ...args: unknown[]) => unknown;

let directory: string;
let project: ProjectDatabase;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-notes-'));
  project = await createProject(join(directory, 'demo.loopy'), 'Demo');
});

afterEach(async () => {
  project.close();
  await rm(directory, { recursive: true, force: true });
});

function setup(open = true) {
  const handlers = new Map<string, Handler>();
  const ipc = { handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler)) };
  const dialogs = {
    showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] as string[] })),
    showSaveDialog: vi.fn(() =>
      Promise.resolve({ canceled: true } as { canceled: boolean; filePath?: string }),
    ),
  };
  const deps = { project: () => (open ? project : null), dialogs };
  registerNotesHandlers(ipc, deps);
  registerBoardsHandlers(ipc, deps);
  registerAssetsHandlers(ipc, deps);
  const call = <T>(channel: string, ...args: unknown[]) =>
    Promise.resolve().then(() => handlers.get(channel)?.({}, ...args)) as Promise<T>;
  return { call, dialogs };
}

describe('notes IPC handlers', () => {
  it('creates notes with unique titles, updates them and deletes them', async () => {
    const { call } = setup();
    await expect(call(IpcChannel.notesList)).resolves.toEqual([]);
    const first = await call<Note>(IpcChannel.notesCreate, { title: 'Enemy AI', body: '# Enemy AI' });
    const second = await call<Note>(IpcChannel.notesCreate, { title: 'enemy ai' });
    expect(first).toMatchObject({ title: 'Enemy AI', body: '# Enemy AI', starred: false, folderId: null });
    expect(second.title).toBe('enemy ai 2');

    const [updated] = await call<Note[]>(IpcChannel.notesUpdate, first.id, {
      body: 'Patrols',
      starred: true,
    });
    expect(updated).toMatchObject({ body: 'Patrols', starred: true });
    await expect(call(IpcChannel.notesUpdate, second.id, { title: 'Enemy AI' })).rejects.toThrow(
      /already exists/,
    );
    await expect(call(IpcChannel.notesCreate, { title: 'Bad/Title' })).rejects.toThrow();

    const remaining = await call<Note[]>(IpcChannel.notesDelete, [first.id]);
    expect(remaining.map((note) => note.title)).toEqual(['enemy ai 2']);
  });

  it('rewrites links in other notes when a note is renamed', async () => {
    const { call } = setup();
    const target = await call<Note>(IpcChannel.notesCreate, { title: 'Combat' });
    const source = await call<Note>(IpcChannel.notesCreate, {
      title: 'Overview',
      body: 'See [[Combat]], [[combat#Melee|melee]] and ![[Combat#^rules]].\n\n```\n[[Combat]]\n```',
    });
    const changed = await call<Note[]>(IpcChannel.notesUpdate, target.id, { title: 'Fighting' });
    expect(changed.map((note) => note.id)).toEqual([target.id, source.id]);
    expect(changed[1]?.body).toBe(
      'See [[Fighting]], [[Fighting#Melee|melee]] and ![[Fighting#^rules]].\n\n```\n[[Combat]]\n```',
    );
  });

  it('rewrites Loopy links when a board or asset is renamed', async () => {
    const { call } = setup();
    const board = await call<Board>(IpcChannel.boardsCreate, { name: 'Level 1' });
    const imported = await call<{ snapshot: AssetsSnapshot; ids: string[] }>(IpcChannel.assetsImport, {
      target: null,
      files: [{ name: 'hero.png', bytes: new Uint8Array([1, 2, 3]) }],
    });
    const note = await call<Note>(IpcChannel.notesCreate, {
      title: 'Plan',
      body: 'Map [[board:Level 1]] with ![[asset:hero.png]]',
    });
    await call(IpcChannel.boardsUpdate, board.id, { name: 'Forest' });
    await call(IpcChannel.assetsUpdate, imported.ids[0], { name: 'knight.png' });
    const notes = await call<Note[]>(IpcChannel.notesList);
    expect(notes.find((item) => item.id === note.id)?.body).toBe(
      'Map [[board:Forest]] with ![[asset:knight.png]]',
    );
  });

  it('keeps notes in note folders and moves them up when their folder goes', async () => {
    const { call } = setup();
    const snapshot = await call<AssetsSnapshot>(IpcChannel.assetsCreateFolder, {
      name: 'Ideas',
      scope: 'notes',
    });
    const folder = snapshot.folders.find((item) => item.name === 'Ideas');
    const boards = await call<AssetsSnapshot>(IpcChannel.assetsCreateFolder, {
      name: 'Maps',
      scope: 'boards',
    });
    const wrong = boards.folders.find((item) => item.name === 'Maps');
    const note = await call<Note>(IpcChannel.notesCreate, { title: 'Pitch', folderId: folder?.id });
    expect(note.folderId).toBe(folder?.id);
    await expect(call(IpcChannel.notesUpdate, note.id, { folderId: wrong?.id })).rejects.toThrow(
      /does not hold/,
    );
    await call(IpcChannel.assetsDeleteFolder, folder?.id);
    const [moved] = await call<Note[]>(IpcChannel.notesList);
    expect(moved?.folderId).toBeNull();
  });

  it('imports markdown files into folders that mirror their paths', async () => {
    const { call } = setup();
    const result = await call<NoteImportResult>(IpcChannel.notesImport, {
      files: [
        { path: 'Vault/World/Lore.md', body: '# Lore' },
        { path: 'Vault/World/Places.md', body: 'Near [[Lore]]' },
        { path: 'Vault/Lore.md', body: 'Duplicate' },
      ],
    });
    expect(result.status).toBe('imported');
    if (result.status !== 'imported') return;
    expect(result.notes.map((note) => note.title).sort()).toEqual(['Lore', 'Lore 2', 'Places']);
    const assets = await call<AssetsSnapshot>(IpcChannel.assetsSnapshot);
    const vault = assets.folders.find((item) => item.name === 'Vault');
    const world = assets.folders.find((item) => item.name === 'World');
    expect(vault?.scope).toBe('notes');
    expect(world?.parentId).toBe(vault?.id);
    expect(result.notes.find((note) => note.title === 'Places')?.folderId).toBe(world?.id);
  });

  it('picks an Obsidian vault folder and links its attachments as assets', async () => {
    const { call, dialogs } = setup();
    const vault = join(directory, 'My Vault');
    await mkdir(join(vault, 'Notes'), { recursive: true });
    await mkdir(join(vault, '.obsidian'), { recursive: true });
    await writeFile(
      join(vault, 'Notes', 'Hero.md'),
      'Art: ![[images/hero.png]] and [[Notes/Villain|bad guy]]',
    );
    await writeFile(join(vault, 'Villain.md'), '# Villain');
    await writeFile(join(vault, 'hero.png'), new Uint8Array([137, 80, 78, 71]));
    await writeFile(join(vault, '.obsidian', 'app.json'), '{}');
    dialogs.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [vault] });

    const result = await call<NoteImportResult>(IpcChannel.notesPick, 'folder', null);
    expect(result.status).toBe('imported');
    if (result.status !== 'imported') return;
    const hero = result.notes.find((note) => note.title === 'Hero');
    expect(hero?.body).toBe('Art: ![[asset:hero.png]] and [[Villain|bad guy]]');
    const assets = await call<AssetsSnapshot>(IpcChannel.assetsSnapshot);
    expect(assets.assets.map((asset) => asset.name)).toEqual(['hero.png']);
  });

  it('exports one note as markdown and converts Loopy links in plain mode', async () => {
    const { call, dialogs } = setup();
    await call(IpcChannel.assetsImport, {
      target: null,
      files: [{ name: 'hero.png', bytes: new Uint8Array([7]) }],
    });
    const note = await call<Note>(IpcChannel.notesCreate, {
      title: 'Hero',
      body: '![[asset:hero.png]] on [[board:Level 1|the map]] near [[Villain]]',
    });
    const file = join(directory, 'out', 'Hero.md');
    dialogs.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: file });
    await expect(call(IpcChannel.notesExport, { ids: [note.id], loopyLinks: 'plain' })).resolves.toEqual({
      status: 'exported',
    });
    expect(await readFile(file, 'utf8')).toBe(
      '![hero.png](attachments/hero.png) on the map near [[Villain]]',
    );
    expect([...(await readFile(join(directory, 'out', 'attachments', 'hero.png')))]).toEqual([7]);

    dialogs.showSaveDialog.mockResolvedValueOnce({ canceled: true });
    await expect(call(IpcChannel.notesExport, { ids: [note.id] })).resolves.toEqual({ status: 'cancelled' });
  });

  it('exports several notes into their folder structure', async () => {
    const { call, dialogs } = setup();
    const result = await call<NoteImportResult>(IpcChannel.notesImport, {
      files: [
        { path: 'World/Lore.md', body: '[[board:Map]]' },
        { path: 'Pitch.md', body: 'Pitch' },
      ],
    });
    if (result.status !== 'imported') throw new Error('import failed');
    const out = join(directory, 'export');
    dialogs.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [out] });
    await call(IpcChannel.notesExport, { ids: result.ids });
    expect(await readFile(join(out, 'World', 'Lore.md'), 'utf8')).toBe('[[board:Map]]');
    expect(await readFile(join(out, 'Pitch.md'), 'utf8')).toBe('Pitch');
  });

  it('keeps versions of a note and restores one', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-18T09:00:00.000Z'), toFake: ['Date'] });
    try {
      const { call } = setup();
      const note = await call<Note>(IpcChannel.notesCreate, { title: 'Pitch', body: 'First' });
      await call(IpcChannel.notesUpdate, note.id, { body: 'Second' });
      await call(IpcChannel.notesUpdate, note.id, { body: 'Third' });
      let versions = await call<NoteVersion[]>(IpcChannel.noteVersionsList, note.id);
      expect(versions.map((version) => version.body)).toEqual(['First']);

      vi.setSystemTime(new Date('2026-10-18T09:06:00.000Z'));
      await call(IpcChannel.notesUpdate, note.id, { body: 'Fourth' });
      await call(IpcChannel.notesUpdate, note.id, { title: 'Elevator pitch' });
      versions = await call<NoteVersion[]>(IpcChannel.noteVersionsList, note.id);
      expect(versions.map((version) => [version.title, version.body])).toEqual([
        ['Pitch', 'Fourth'],
        ['Pitch', 'Third'],
        ['Pitch', 'First'],
      ]);

      const [restored] = await call<Note[]>(IpcChannel.noteVersionsRestore, versions[2]?.id);
      expect(restored).toMatchObject({ title: 'Elevator pitch', body: 'First' });
      versions = await call<NoteVersion[]>(IpcChannel.noteVersionsList, note.id);
      expect(versions[0]).toMatchObject({ title: 'Elevator pitch', body: 'Fourth' });
      await expect(call(IpcChannel.noteVersionsRestore, 'missing')).rejects.toThrow(/Unknown note version/);
      await expect(call(IpcChannel.noteVersionsList, 'missing')).rejects.toThrow(/Unknown note/);

      await call(IpcChannel.notesDelete, [note.id]);
      const left = project.db.prepare('SELECT COUNT(*) AS count FROM note_versions').get() as {
        count: number;
      };
      expect(left.count).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps at most fifty versions of a note', async () => {
    const { call } = setup();
    const note = await call<Note>(IpcChannel.notesCreate, { title: 'Busy' });
    for (let index = 0; index < 55; index += 1) {
      await call(IpcChannel.notesUpdate, note.id, { title: `Busy ${String(index)}` });
    }
    const versions = await call<NoteVersion[]>(IpcChannel.noteVersionsList, note.id);
    expect(versions).toHaveLength(50);
    expect(versions[0]?.title).toBe('Busy 53');
  });

  it('merges one note into another and points links at the target', async () => {
    const { call } = setup();
    const target = await call<Note>(IpcChannel.notesCreate, { title: 'Combat', body: '# Combat' });
    const source = await call<Note>(IpcChannel.notesCreate, {
      title: 'Melee',
      body: '---\ntags: [x]\n---\n## Melee\nSwords.',
    });
    const other = await call<Note>(IpcChannel.notesCreate, {
      title: 'Index',
      body: 'See [[Melee#Melee|close]]',
    });
    const notes = await call<Note[]>(IpcChannel.notesMerge, source.id, target.id);
    expect(notes.map((note) => note.title)).toEqual(['Combat', 'Index']);
    expect(notes.find((note) => note.id === target.id)?.body).toBe('# Combat\n\n## Melee\nSwords.\n');
    expect(notes.find((note) => note.id === other.id)?.body).toBe('See [[Combat#Melee|close]]');
    const versions = await call<NoteVersion[]>(IpcChannel.noteVersionsList, target.id);
    expect(versions[0]?.body).toBe('# Combat');
    await expect(call(IpcChannel.notesMerge, target.id, target.id)).rejects.toThrow(/itself/);
  });

  it('refuses every channel when no project is open', async () => {
    const { call } = setup(false);
    await expect(call(IpcChannel.notesList)).rejects.toThrow(/No project/);
    await expect(call(IpcChannel.notesCreate, { title: 'x' })).rejects.toThrow(/No project/);
  });
});
