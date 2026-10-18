import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IpcChannel,
  type OpenProjectResult,
  type ProjectState,
  type RecentProjectEntry,
  type SaveProjectResult,
} from '@shared/ipc';
import type { ProjectInfo } from '@shared/project';
import { registerProjectHandlers, type ProjectService } from '../../../src/main/ipc/project';
import type { SaveChoice } from '../../../src/main/open-file';
import { createDeviceStateService } from '../../../src/main/services/device-state';
import type { FileDialogs } from '../../../src/main/ipc/themes';
import {
  createDeviceStateStore,
  createProject,
  openProject,
  readProjectInfo,
  storagePaths,
} from '../../../src/main/storage';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

function fakeIpc() {
  const handlers = new Map<string, Handler>();
  return {
    handle: vi.fn((channel: string, handler: Handler) => {
      handlers.set(channel, handler);
    }),
    call: <T>(channel: string, ...args: unknown[]) =>
      Promise.resolve(handlers.get(channel)?.({}, ...args)) as Promise<T>,
  };
}

let directory: string;
const services: ProjectService[] = [];

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-project-ipc-'));
});

afterEach(async () => {
  for (const service of services.splice(0)) service.dispose();
  await rm(directory, { recursive: true, force: true });
});

interface Setup {
  dialogs?: Partial<FileDialogs>;
  choice?: SaveChoice;
  track?: boolean;
}

async function setup({ dialogs = {}, choice = 'cancel', track = true }: Setup = {}) {
  const paths = storagePaths(directory);
  const ipc = fakeIpc();
  const broadcast = vi.fn();
  const revealInFolder = vi.fn();
  const confirmSave = vi.fn((_name: string) => Promise.resolve(choice));
  const showSaveDialog = vi.fn(() => Promise.resolve({ canceled: true }));
  const showOpenDialog = vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] as string[] }));
  const service = await registerProjectHandlers(ipc, {
    paths,
    deviceState: await createDeviceStateService(createDeviceStateStore(paths.deviceState)),
    broadcast,
    revealInFolder,
    confirmSave,
    dialogs: { showSaveDialog, showOpenDialog, ...dialogs },
  });
  if (track) services.push(service);
  return { paths, ipc, broadcast, revealInFolder, confirmSave, showSaveDialog, service };
}

const saveTo = (filePath: string): Partial<FileDialogs> => ({
  showSaveDialog: () => Promise.resolve({ canceled: false, filePath }),
});
const openFrom = (filePath: string): Partial<FileDialogs> => ({
  showOpenDialog: () => Promise.resolve({ canceled: false, filePaths: [filePath] }),
});

async function nameIn(path: string): Promise<string> {
  const project = await openProject(path);
  try {
    return readProjectInfo(project).name;
  } finally {
    project.close();
  }
}

async function external(name: string): Promise<string> {
  const path = join(directory, 'files', `${name}.loopy`);
  (await createProject(path, name)).close();
  return path;
}

describe('creating a project', () => {
  it('opens an untitled project without asking where to save it', async () => {
    const { ipc, paths, service, showSaveDialog } = await setup();

    const result = await ipc.call<OpenProjectResult>(IpcChannel.projectCreate, 'Untitled');

    expect(result).toMatchObject({ status: 'opened', project: { name: 'Untitled' } });
    expect(showSaveDialog).not.toHaveBeenCalled();
    expect(service.current()?.path.startsWith(paths.working)).toBe(true);
    expect(service.state()).toMatchObject({ path: null, dirty: false, recent: [] });
    expect(service.needsSave()).toBe(true);
  });

  it('asks before replacing a project with unsaved work and keeps it when cancelled', async () => {
    const { ipc, confirmSave, service } = await setup({ choice: 'cancel' });
    await ipc.call(IpcChannel.projectCreate, 'First');

    const result = await ipc.call<OpenProjectResult>(IpcChannel.projectCreate, 'Second');

    expect(confirmSave).toHaveBeenCalledWith('First');
    expect(result).toEqual({ status: 'cancelled' });
    expect(service.state().current?.name).toBe('First');
  });

  it('renames the open project and marks it unsaved', async () => {
    const { ipc, broadcast, service } = await setup();
    await ipc.call(IpcChannel.projectCreate, 'Untitled');

    const info = await ipc.call<ProjectInfo>(IpcChannel.projectRename, 'Dungeon');

    expect(info.name).toBe('Dungeon');
    expect(service.state()).toMatchObject({ current: { name: 'Dungeon' }, dirty: true });
    expect(broadcast).toHaveBeenLastCalledWith(IpcChannel.projectChanged, service.state());
    await expect(ipc.call(IpcChannel.projectRename, '')).rejects.toThrow();
  });
});

describe('saving', () => {
  it('asks for a location the first time and remembers the file in recent', async () => {
    const target = join(directory, 'chosen', 'Quest.loopy');
    const { ipc, service } = await setup({ dialogs: saveTo(target) });
    await ipc.call(IpcChannel.projectCreate, 'Quest');

    const result = await ipc.call<SaveProjectResult>(IpcChannel.projectSave);

    expect(result).toEqual({ status: 'saved' });
    await expect(nameIn(target)).resolves.toBe('Quest');
    expect(service.state()).toMatchObject({ path: target, dirty: false });
    expect(service.state().recent).toEqual([expect.objectContaining({ name: 'Quest', path: target })]);
    expect(service.needsSave()).toBe(false);
  });

  it('stays untitled when the save dialog is cancelled', async () => {
    const { ipc, service } = await setup();
    await ipc.call(IpcChannel.projectCreate, 'Untitled');

    await expect(ipc.call(IpcChannel.projectSave)).resolves.toEqual({ status: 'cancelled' });
    expect(service.state().path).toBeNull();
  });

  it('saves a saved project in place without a dialog', async () => {
    const source = await external('Quest');
    const { ipc, service, showSaveDialog } = await setup({ dialogs: openFrom(source) });
    await ipc.call(IpcChannel.projectOpen);
    await ipc.call(IpcChannel.projectRename, 'Quest 2');

    await expect(ipc.call(IpcChannel.projectSave)).resolves.toEqual({ status: 'saved' });

    expect(showSaveDialog).not.toHaveBeenCalled();
    await expect(nameIn(source)).resolves.toBe('Quest 2');
    expect(service.state().dirty).toBe(false);
  });

  it('saves to a new file with Save As and keeps saving there', async () => {
    const source = await external('Quest');
    const copy = join(directory, 'copies', 'Quest copy.loopy');
    const { ipc, service } = await setup({ dialogs: { ...openFrom(source), ...saveTo(copy) } });
    await ipc.call(IpcChannel.projectOpen);

    await expect(ipc.call(IpcChannel.projectSaveAs)).resolves.toEqual({ status: 'saved' });
    await ipc.call(IpcChannel.projectRename, 'Copy');
    await ipc.call(IpcChannel.projectSave);

    expect(service.state().path).toBe(copy);
    await expect(nameIn(copy)).resolves.toBe('Copy');
    await expect(nameIn(source)).resolves.toBe('Quest');
  });

  it('reports a failed save and keeps the changes unsaved', async () => {
    const blocker = join(directory, 'blocker');
    await writeFile(blocker, 'not a folder', 'utf8');
    const { ipc, service } = await setup({ dialogs: saveTo(join(blocker, 'x.loopy')) });
    await ipc.call(IpcChannel.projectCreate, 'Untitled');
    await service.markDirty();

    await expect(ipc.call(IpcChannel.projectSave)).resolves.toEqual({ status: 'failed' });
    expect(service.state()).toMatchObject({ path: null, dirty: true });
  });

  it('cancels save when no project is open', async () => {
    const { ipc } = await setup();

    await expect(ipc.call(IpcChannel.projectSave)).resolves.toEqual({ status: 'cancelled' });
    await expect(ipc.call(IpcChannel.projectSaveAs)).resolves.toEqual({ status: 'cancelled' });
  });
});

describe('tracking changes', () => {
  it('broadcasts once when the first change arrives', async () => {
    const { ipc, broadcast, service } = await setup();
    await ipc.call(IpcChannel.projectCreate, 'Untitled');
    broadcast.mockClear();

    await service.markDirty();
    await service.markDirty();

    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(broadcast).toHaveBeenCalledWith(
      IpcChannel.projectChanged,
      expect.objectContaining({ dirty: true }),
    );
  });

  it('ignores changes when no project is open', async () => {
    const { broadcast, service } = await setup();

    await service.markDirty();

    expect(broadcast).not.toHaveBeenCalled();
  });
});

describe('opening files', () => {
  it('opens a file from any folder without copying it into the app', async () => {
    const source = await external('Quest');
    const { ipc, service, paths } = await setup({ dialogs: openFrom(source) });

    const result = await ipc.call<OpenProjectResult>(IpcChannel.projectOpen);

    expect(result).toMatchObject({ status: 'opened', project: { name: 'Quest' } });
    expect(service.state()).toMatchObject({ path: source, dirty: false });
    expect(service.state().recent[0]).toMatchObject({ path: source, name: 'Quest' });
    await expect(readdir(paths.projects)).rejects.toThrow();
  });

  it('cancels when the open dialog is dismissed', async () => {
    const { ipc } = await setup();

    await expect(ipc.call(IpcChannel.projectOpen)).resolves.toEqual({ status: 'cancelled' });
  });

  it('reports missing files and files that are not projects', async () => {
    const { service } = await setup();
    const text = join(directory, 'text.loopy');
    await writeFile(text, 'hello', 'utf8');

    await expect(service.openFile(join(directory, 'gone.loopy'))).resolves.toEqual({
      status: 'failed',
      code: 'NOT_FOUND',
    });
    await expect(service.openFile(text)).resolves.toEqual({ status: 'failed', code: 'NOT_A_PROJECT' });
  });

  it('keeps the open project when the same file is opened again', async () => {
    const source = await external('Quest');
    const { service } = await setup();
    await service.openFile(source);
    await service.markDirty();

    await expect(service.openFile(source)).resolves.toMatchObject({ status: 'opened' });
    expect(service.state().dirty).toBe(true);
  });

  it('opens a recent file by path and refuses a path that is not recent', async () => {
    const first = await external('First');
    const second = await external('Second');
    const { ipc, service } = await setup();
    await service.openFile(first);
    await service.openFile(second);

    const result = await ipc.call<OpenProjectResult>(IpcChannel.projectOpenRecent, first);

    expect(result).toMatchObject({ status: 'opened', project: { name: 'First' } });
    expect(service.state().recent.map((entry) => entry.path)).toEqual([first, second]);
    await expect(ipc.call(IpcChannel.projectOpenRecent, join(directory, 'other.loopy'))).rejects.toThrow();
  });

  it('lists recent files and flags the ones that are gone', async () => {
    const kept = await external('Kept');
    const gone = await external('Gone');
    const { ipc, service } = await setup();
    await service.openFile(gone);
    await service.openFile(kept);
    await rm(gone);

    const list = await ipc.call<RecentProjectEntry[]>(IpcChannel.projectList);

    expect(list).toEqual([
      expect.objectContaining({ path: kept, missing: false }),
      expect.objectContaining({ path: gone, missing: true }),
    ]);
  });

  it('removes and reveals recent files only by a known path', async () => {
    const source = await external('Quest');
    const { ipc, revealInFolder, service } = await setup();
    await service.openFile(source);

    await ipc.call(IpcChannel.projectReveal, source);
    expect(revealInFolder).toHaveBeenCalledWith(source);
    await expect(ipc.call(IpcChannel.projectReveal, join(directory, 'secret.txt'))).rejects.toThrow();

    const state = await ipc.call<ProjectState>(IpcChannel.projectRemoveRecent, source);
    expect(state.recent).toEqual([]);
  });
});

describe('guarding unsaved work', () => {
  it('lets a saved project with no changes close without asking', async () => {
    const source = await external('Quest');
    const { confirmSave, service } = await setup();
    await service.openFile(source);

    await expect(service.guard()).resolves.toBe(true);
    expect(confirmSave).not.toHaveBeenCalled();
  });

  it('asks about an untitled project and stays open when cancelled', async () => {
    const { ipc, confirmSave, service } = await setup({ choice: 'cancel' });
    await ipc.call(IpcChannel.projectCreate, 'Untitled');

    await expect(service.guard()).resolves.toBe(false);
    await ipc.call(IpcChannel.projectClose);

    expect(confirmSave).toHaveBeenCalledTimes(2);
    expect(service.current()).not.toBeNull();
  });

  it('throws away unsaved work and the working copy when the user discards', async () => {
    const { ipc, paths, service } = await setup({ choice: 'discard' });
    await ipc.call(IpcChannel.projectCreate, 'Untitled');

    await ipc.call(IpcChannel.projectClose);

    expect(service.current()).toBeNull();
    await expect(readdir(paths.working)).resolves.toEqual([]);
  });

  it('saves before continuing when the user chooses Save', async () => {
    const target = join(directory, 'Quest.loopy');
    const { ipc, service } = await setup({ choice: 'save', dialogs: saveTo(target) });
    await ipc.call(IpcChannel.projectCreate, 'Quest');

    await expect(service.guard()).resolves.toBe(true);
    await expect(nameIn(target)).resolves.toBe('Quest');
  });

  it('stays open when Save is chosen but the save dialog is cancelled', async () => {
    const { ipc, service } = await setup({ choice: 'save' });
    await ipc.call(IpcChannel.projectCreate, 'Quest');

    await expect(service.guard()).resolves.toBe(false);
  });

  it('asks before opening another file over unsaved work', async () => {
    const source = await external('Quest');
    const { ipc, confirmSave, service } = await setup({ choice: 'cancel' });
    await ipc.call(IpcChannel.projectCreate, 'Untitled');

    await expect(service.openFile(source)).resolves.toEqual({ status: 'cancelled' });
    expect(confirmSave).toHaveBeenCalledWith('Untitled');
  });
});

describe('recovering after a crash', () => {
  async function crash() {
    const source = await external('Quest');
    const first = await setup({ track: false });
    await first.service.openFile(source);
    await first.ipc.call(IpcChannel.projectRename, 'Lost work');
    first.service.current()?.close();
    return source;
  }

  it('offers unsaved work from the last run and restores it as unsaved', async () => {
    const source = await crash();
    const { ipc, service } = await setup();
    const [entry] = service.state().recoverable;

    expect(service.state().recoverable).toEqual([
      expect.objectContaining({ name: 'Lost work', path: source }),
    ]);
    const result = await ipc.call<OpenProjectResult>(IpcChannel.projectRecover, entry?.id);

    expect(result).toMatchObject({ status: 'opened', project: { name: 'Lost work' } });
    expect(service.state()).toMatchObject({ path: source, dirty: true, recoverable: [] });
  });

  it('discards recovered work on request', async () => {
    await crash();
    const { ipc, paths, service } = await setup();
    const id = service.state().recoverable[0]?.id;

    const state = await ipc.call<ProjectState>(IpcChannel.projectDiscardRecovery, id);

    expect(state.recoverable).toEqual([]);
    await expect(readdir(paths.working)).resolves.toEqual([]);
  });

  it('refuses ids that are not offered', async () => {
    const { ipc } = await setup();

    await expect(ipc.call(IpcChannel.projectRecover, crypto.randomUUID())).rejects.toThrow();
    await expect(ipc.call(IpcChannel.projectDiscardRecovery, 'nope')).rejects.toThrow();
  });

  it('leaves nothing behind after a clean shutdown', async () => {
    const { ipc, paths, service } = await setup({ track: false });
    await ipc.call(IpcChannel.projectCreate, 'Untitled');

    service.dispose();

    await expect(readdir(paths.working)).resolves.toEqual([]);
  });
});
