import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createProject,
  openProject,
  readProjectInfo,
  type ProjectFileError,
} from '../../../src/main/storage';
import {
  collectOrphans,
  createSession,
  openSession,
  restoreSession,
  type ProjectSession,
} from '../../../src/main/storage/project-session';

let directory: string;
let working: string;
const sessions: ProjectSession[] = [];

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-session-'));
  working = join(directory, 'working');
});

afterEach(async () => {
  for (const session of sessions.splice(0)) session.close();
  await rm(directory, { recursive: true, force: true });
});

async function track(promise: Promise<ProjectSession>): Promise<ProjectSession> {
  const session = await promise;
  sessions.push(session);
  return session;
}

async function nameIn(path: string): Promise<string> {
  const project = await openProject(path);
  try {
    return readProjectInfo(project).name;
  } finally {
    project.close();
  }
}

async function manifest(session: ProjectSession): Promise<unknown> {
  return JSON.parse(await readFile(join(working, `${session.id}.json`), 'utf8'));
}

describe('an untitled session', () => {
  it('lives in the working directory until it is saved', async () => {
    const session = await track(createSession(working, 'Untitled'));

    expect(session.savedPath).toBeNull();
    expect(session.dirty).toBe(false);
    expect(session.needsSave).toBe(true);
    expect(session.info().name).toBe('Untitled');
    expect(session.project.path).toBe(join(working, `${session.id}.loopy`));
    await expect(manifest(session)).resolves.toMatchObject({
      savedPath: null,
      dirty: false,
      name: 'Untitled',
    });
  });

  it('records a change in its manifest so a crash can recover it', async () => {
    const session = await track(createSession(working, 'Untitled'));

    await session.markDirty();

    expect(session.dirty).toBe(true);
    await expect(manifest(session)).resolves.toMatchObject({ dirty: true });
  });

  it('renames the project and counts the rename as a change', async () => {
    const session = await track(createSession(working, 'Untitled'));

    const info = await session.rename('  Dungeon  ');

    expect(info.name).toBe('Dungeon');
    expect(session.info().name).toBe('Dungeon');
    expect(session.dirty).toBe(true);
    await expect(manifest(session)).resolves.toMatchObject({ name: 'Dungeon', dirty: true });
    await expect(session.rename('   ')).rejects.toThrow();
  });
});

describe('saving', () => {
  it('writes the project to the chosen file and clears the change flag', async () => {
    const session = await track(createSession(working, 'Untitled'));
    await session.rename('Saved');
    const target = join(directory, 'chosen', 'Saved.loopy');

    await session.saveTo(target);

    expect(session.savedPath).toBe(target);
    expect(session.dirty).toBe(false);
    expect(session.needsSave).toBe(false);
    await expect(nameIn(target)).resolves.toBe('Saved');
    await expect(manifest(session)).resolves.toMatchObject({ savedPath: target, dirty: false });
  });

  it('replaces an existing file atomically and leaves no temporary or stale journal files', async () => {
    const target = join(directory, 'game.loopy');
    (await createProject(target, 'Old')).close();
    await writeFile(`${target}-wal`, 'stale journal', 'utf8');
    const session = await track(createSession(working, 'New'));

    await session.saveTo(target);

    expect((await readdir(directory)).filter((name) => name.startsWith('game'))).toEqual(['game.loopy']);
    await expect(nameIn(target)).resolves.toBe('New');
  });

  it('keeps the change flag when a save fails', async () => {
    const session = await track(createSession(working, 'Untitled'));
    await session.markDirty();
    const blocker = join(directory, 'blocker');
    await writeFile(blocker, 'a file, not a folder', 'utf8');

    await expect(session.saveTo(join(blocker, 'game.loopy'))).rejects.toThrow();

    expect(session.dirty).toBe(true);
    expect(session.savedPath).toBeNull();
  });
});

describe('opening a file', () => {
  it('edits a working copy and leaves the original alone until saved', async () => {
    const source = join(directory, 'usb', 'Quest.loopy');
    (await createProject(source, 'Quest')).close();
    const session = await track(openSession(working, source));

    expect(session.savedPath).toBe(source);
    expect(session.needsSave).toBe(false);
    expect(session.project.path).not.toBe(source);

    await session.rename('Quest 2');
    await expect(nameIn(source)).resolves.toBe('Quest');

    await session.saveTo(source);
    await expect(nameIn(source)).resolves.toBe('Quest 2');
  });

  it('reports a missing file and leaves nothing in the working directory', async () => {
    await expect(openSession(working, join(directory, 'gone.loopy'))).rejects.toMatchObject({
      code: 'NOT_FOUND',
    } satisfies Partial<ProjectFileError>);
    await expect(readdir(working)).resolves.toEqual([]);
  });

  it('rejects a file that is not a project', async () => {
    const source = join(directory, 'notes.loopy');
    await writeFile(source, 'plain text', 'utf8');

    await expect(openSession(working, source)).rejects.toMatchObject({ code: 'NOT_A_PROJECT' });
    await expect(readdir(working)).resolves.toEqual([]);
  });
});

describe('ending and recovering sessions', () => {
  it('removes the working copy and manifest on discard', async () => {
    const session = await createSession(working, 'Untitled');

    session.discard();

    await expect(readdir(working)).resolves.toEqual([]);
  });

  it('offers work left behind by a crash and drops sessions that had nothing unsaved', async () => {
    const source = join(directory, 'clean.loopy');
    (await createProject(source, 'Clean')).close();
    const untitled = await createSession(working, 'Untitled');
    const edited = await openSession(working, source);
    await edited.rename('Edited');
    const clean = await openSession(working, source);
    for (const session of [untitled, edited, clean]) session.close();
    await writeFile(join(working, 'broken.json'), '{', 'utf8');

    const orphans = await collectOrphans(working);

    expect(orphans).toHaveLength(2);
    expect(orphans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: untitled.id, name: 'Untitled', path: null }),
        expect.objectContaining({ id: edited.id, name: 'Edited', path: source }),
      ]),
    );
    const left = await readdir(working);
    expect(left.some((name) => name.startsWith(clean.id))).toBe(false);
    expect(left).not.toContain('broken.json');
  });

  it('restores a recovered session with its changes still unsaved', async () => {
    const source = join(directory, 'crash.loopy');
    (await createProject(source, 'Crash')).close();
    const lost = await openSession(working, source);
    await lost.rename('Recovered');
    lost.close();

    const session = await track(restoreSession(working, lost.id));

    expect(session.id).toBe(lost.id);
    expect(session.info().name).toBe('Recovered');
    expect(session.savedPath).toBe(source);
    expect(session.dirty).toBe(true);
  });

  it('returns nothing when the working directory does not exist', async () => {
    await expect(collectOrphans(join(directory, 'none'))).resolves.toEqual([]);
  });
});
