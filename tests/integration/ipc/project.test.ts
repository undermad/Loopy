import { mkdtemp, readdir, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IpcChannel, type OpenProjectResult, type ProjectState, type ProjectSummary } from '@shared/ipc';
import type { ProjectInfo } from '@shared/project';
import { registerProjectHandlers } from '../../../src/main/ipc/project';
import { createDeviceStateService } from '../../../src/main/services/device-state';
import type { FileDialogs } from '../../../src/main/ipc/themes';
import { createDeviceStateStore, createProject, storagePaths } from '../../../src/main/storage';

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

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-project-ipc-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function setup(dialogs: Partial<FileDialogs> = {}, replace = true) {
  const paths = storagePaths(directory);
  const ipc = fakeIpc();
  const broadcast = vi.fn();
  const revealInFolder = vi.fn();
  const confirmReplace = vi.fn((_name: string) => Promise.resolve(replace));
  const service = registerProjectHandlers(ipc, {
    paths,
    deviceState: await createDeviceStateService(createDeviceStateStore(paths.deviceState)),
    broadcast,
    revealInFolder,
    confirmReplace,
    dialogs: {
      showSaveDialog: vi.fn(() => Promise.resolve({ canceled: true })),
      showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })),
      ...dialogs,
    },
  });
  return { paths, ipc, broadcast, revealInFolder, confirmReplace, service };
}

async function projectPair(paths: ReturnType<typeof storagePaths>) {
  const id = crypto.randomUUID();
  const external = join(directory, 'external', 'shared.loopy');
  (await createProject(paths.projectFile(id), 'Local', new Date(), id)).close();
  (await createProject(external, 'External', new Date(), id)).close();
  const past = new Date(Date.now() - 60_000);
  await utimes(external, past, past);
  return { id, external };
}

describe('opening a project file from the operating system', () => {
  it('opens a file that is already in the library without copying it', async () => {
    const { paths, service } = await setup();
    const id = crypto.randomUUID();
    (await createProject(paths.projectFile(id), 'Library', new Date(), id)).close();

    try {
      const result = await service.openFile(paths.projectFile(id));
      expect(result).toMatchObject({ status: 'opened', project: { id, name: 'Library' } });
      expect(service.state().current?.id).toBe(id);
      const files = (await readdir(paths.projects)).filter((name) => name.endsWith('.loopy'));
      expect(files).toEqual([`${id}.loopy`]);
    } finally {
      await service.close();
    }
  });

  it('imports an external file and makes it the current project', async () => {
    const external = join(directory, 'downloads', 'Quest.loopy');
    (await createProject(external, 'Quest')).close();
    const { paths, broadcast, service } = await setup();

    try {
      const result = await service.openFile(external);
      expect(result).toMatchObject({ status: 'imported', project: { name: 'Quest' } });
      const id = service.state().current?.id;
      await expect(readdir(paths.projects)).resolves.toContain(`${id}.loopy`);
      expect(broadcast.mock.lastCall?.[0]).toBe(IpcChannel.projectChanged);
      expect(broadcast.mock.lastCall?.[1]).toMatchObject({ current: { name: 'Quest' } });
    } finally {
      await service.close();
    }
  });

  it('reports a missing file instead of throwing', async () => {
    const { service } = await setup();

    await expect(service.openFile(join(directory, 'gone.loopy'))).resolves.toEqual({
      status: 'failed',
      code: 'NOT_FOUND',
    });
  });

  it('keeps a newer local copy when the user declines to replace it', async () => {
    const { paths, confirmReplace, service } = await setup({}, false);
    const { id, external } = await projectPair(paths);

    try {
      const result = await service.openFile(external);
      expect(confirmReplace).toHaveBeenCalledWith('Local');
      expect(result).toMatchObject({ status: 'opened', project: { id, name: 'Local' } });
    } finally {
      await service.close();
    }
  });

  it('replaces a newer local copy when the user agrees', async () => {
    const { paths, confirmReplace, service } = await setup({}, true);
    const { id, external } = await projectPair(paths);

    try {
      const result = await service.openFile(external);
      expect(confirmReplace).toHaveBeenCalledWith('Local');
      expect(result).toMatchObject({ status: 'imported', project: { id, name: 'External' } });
    } finally {
      await service.close();
    }
  });

  it('asks before File, Import replaces a newer local copy', async () => {
    const paths = storagePaths(directory);
    const { external } = await projectPair(paths);
    const { ipc, confirmReplace, service } = await setup(
      { showOpenDialog: () => Promise.resolve({ canceled: false, filePaths: [external] }) },
      false,
    );

    try {
      const result = await ipc.call<{ status: string }>(IpcChannel.projectImport);
      expect(confirmReplace).toHaveBeenCalledWith('Local');
      expect(result.status).toBe('cancelled');
    } finally {
      await service.close();
    }
  });
});

describe('project IPC handlers', () => {
  it('creates, lists, opens, closes and deletes projects while tracking recent projects', async () => {
    const { paths, ipc, broadcast, service } = await setup();

    const created = await ipc.call<ProjectInfo>(IpcChannel.projectCreate, 'Demo');
    expect(created.name).toBe('Demo');
    expect(service.current()?.path).toBe(paths.projectFile(created.id));
    expect(broadcast).toHaveBeenLastCalledWith(IpcChannel.projectChanged, {
      current: created,
      recent: [expect.objectContaining({ id: created.id, name: 'Demo' })],
    });

    const second = await ipc.call<ProjectInfo>(IpcChannel.projectCreate, 'Second');
    const list = await ipc.call<ProjectSummary[]>(IpcChannel.projectList);
    expect(list.map((item) => item.id)).toEqual([second.id, created.id]);
    expect(list[0]?.lastOpenedAt).toBeDefined();

    await ipc.call(IpcChannel.projectClose);
    expect(service.current()).toBeNull();

    const opened = await ipc.call<OpenProjectResult>(IpcChannel.projectOpen, created.id);
    expect(opened).toEqual({ status: 'opened', project: created });

    const state = await ipc.call<ProjectState>(IpcChannel.projectState);
    expect(state.current?.id).toBe(created.id);
    expect(state.recent.map((item) => item.id)).toEqual([created.id, second.id]);

    await ipc.call(IpcChannel.projectDelete, created.id);
    expect(service.current()).toBeNull();
    await expect(readdir(paths.projects)).resolves.toEqual([`${second.id}.loopy`]);

    const afterRemove = await ipc.call<ProjectState>(IpcChannel.projectRemoveRecent, second.id);
    expect(afterRemove.recent).toEqual([]);
    await service.close();
  });

  it('reports a missing project instead of throwing', async () => {
    const { ipc } = await setup();

    await expect(ipc.call(IpcChannel.projectOpen, crypto.randomUUID())).resolves.toEqual({
      status: 'failed',
      code: 'NOT_FOUND',
    });
    await expect(ipc.call(IpcChannel.projectOpen, 'not-a-uuid')).rejects.toThrow();
  });

  it('imports a copy of an external file and exports the open project', async () => {
    const external = join(directory, 'external', 'game.loopy');
    const source = await createProject(external, 'Imported');
    source.close();
    const exported = join(directory, 'exported.loopy');
    const { paths, ipc, revealInFolder, service } = await setup({
      showOpenDialog: () => Promise.resolve({ canceled: false, filePaths: [external] }),
      showSaveDialog: () => Promise.resolve({ canceled: false, filePath: exported }),
    });

    const imported = await ipc.call<{ status: string; project: ProjectInfo }>(IpcChannel.projectImport);
    expect(imported.status).toBe('imported');
    expect(imported.project.name).toBe('Imported');
    await expect(readdir(paths.projects)).resolves.toContain(`${imported.project.id}.loopy`);

    await expect(ipc.call(IpcChannel.projectExport)).resolves.toEqual({ status: 'exported' });
    await expect(readdir(directory)).resolves.toContain('exported.loopy');

    await ipc.call(IpcChannel.projectReveal, imported.project.id);
    expect(revealInFolder).toHaveBeenCalledWith(paths.projectFile(imported.project.id));
    await service.close();
  });

  it('reports a missing file on import', async () => {
    const { ipc } = await setup({
      showOpenDialog: () => Promise.resolve({ canceled: false, filePaths: [join(directory, 'nope.loopy')] }),
    });

    await expect(ipc.call(IpcChannel.projectImport)).resolves.toEqual({
      status: 'failed',
      code: 'NOT_FOUND',
    });
  });
});

describe('project handler branches', () => {
  it('skips unreadable files, keeps the current project on a repeated open and replaces a re-imported project', async () => {
    const { paths, ipc, service } = await setup();
    const created = await ipc.call<ProjectInfo>(IpcChannel.projectCreate, 'Demo');
    const { writeFile, mkdir } = await import('node:fs/promises');
    await mkdir(paths.projects, { recursive: true });
    await writeFile(join(paths.projects, `${crypto.randomUUID()}.loopy`), 'not a database', 'utf8');
    const list = await ipc.call<ProjectSummary[]>(IpcChannel.projectList);
    expect(list.map((item) => item.id)).toEqual([created.id]);

    await expect(ipc.call(IpcChannel.projectOpen, created.id)).resolves.toEqual({
      status: 'opened',
      project: created,
    });
    await ipc.call(IpcChannel.projectClose);
    await expect(ipc.call(IpcChannel.projectExport)).resolves.toEqual({ status: 'cancelled' });
    await service.close();
  });

  it('re-imports a project that already exists by replacing the file', async () => {
    const external = join(directory, 'external', 'twice.loopy');
    const source = await createProject(external, 'Twice');
    source.close();
    const { paths, ipc, service } = await setup({
      showOpenDialog: () => Promise.resolve({ canceled: false, filePaths: [external] }),
    });

    try {
      const first = await ipc.call<{ status: string; project: ProjectInfo }>(IpcChannel.projectImport);
      const second = await ipc.call<{ status: string; project: ProjectInfo }>(IpcChannel.projectImport);
      expect(first.project.id).toBe(second.project.id);
      const files = (await readdir(paths.projects)).filter((name) => name.endsWith('.loopy'));
      expect(files).toEqual([`${first.project.id}.loopy`]);
    } finally {
      await service.close();
    }
  });
});
