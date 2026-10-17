import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IpcChannel, type OpenProjectResult, type ProjectState, type ProjectSummary } from '@shared/ipc';
import type { ProjectInfo } from '@shared/project';
import { registerProjectHandlers } from '../../../src/main/ipc/project';
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

async function setup(dialogs: Partial<FileDialogs> = {}) {
  const paths = storagePaths(directory);
  const ipc = fakeIpc();
  const broadcast = vi.fn();
  const revealInFolder = vi.fn();
  const service = await registerProjectHandlers(ipc, {
    paths,
    deviceState: createDeviceStateStore(paths.deviceState),
    broadcast,
    revealInFolder,
    dialogs: {
      showSaveDialog: vi.fn(() => Promise.resolve({ canceled: true })),
      showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })),
      ...dialogs,
    },
  });
  return { paths, ipc, broadcast, revealInFolder, service };
}

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
