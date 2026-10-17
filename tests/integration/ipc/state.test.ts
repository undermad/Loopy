import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IpcChannel, type ShellState } from '@shared/ipc';
import { LAYOUT_SCHEMA_VERSION } from '@shared/layout';
import { buildWorkspace } from '@shared/layout-presets';
import { registerStateHandlers } from '../../../src/main/ipc/state';
import { createDeviceStateService } from '../../../src/main/services/device-state';
import { createDeviceStateStore } from '../../../src/main/storage';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-state-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('state IPC handlers', () => {
  it('returns defaults, persists workspaces and the status bar flag, and serialises writes', async () => {
    const path = join(directory, 'state.json');
    const service = await createDeviceStateService(createDeviceStateStore(path));
    const handlers = new Map<string, Handler>();
    const ipc = { handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler)) };
    registerStateHandlers(ipc, { deviceState: service });
    const call = <T>(channel: string, ...args: unknown[]) =>
      Promise.resolve(handlers.get(channel)?.({}, ...args)) as Promise<T>;

    await expect(call<ShellState>(IpcChannel.stateGet)).resolves.toEqual({
      workspaces: null,
      statusBar: true,
    });

    const workspace = buildWorkspace('planning', 'Planning');
    const workspaces = { schemaVersion: LAYOUT_SCHEMA_VERSION, items: [workspace], activeId: workspace.id };
    const [first, second] = await Promise.all([
      call<ShellState>(IpcChannel.stateSet, { workspaces }),
      call<ShellState>(IpcChannel.stateSet, { statusBar: false }),
    ]);
    expect(first.workspaces?.activeId).toBe(workspace.id);
    expect(second).toEqual({ workspaces, statusBar: false });

    const reloaded = await createDeviceStateService(createDeviceStateStore(path));
    expect(reloaded.get().workspaces).toEqual(workspaces);
    expect(reloaded.get().statusBar).toBe(false);

    await call(IpcChannel.stateSet, { workspaces: null });
    expect(service.get().workspaces).toBeUndefined();
    await expect(call(IpcChannel.stateSet, { statusBar: 'yes' })).rejects.toThrow();
  });

  it('falls back to defaults when the file is corrupt', async () => {
    const onLoadError = vi.fn();
    const store = {
      path: 'x',
      defaults: () => createDeviceStateStore('x').defaults(),
      load: () => Promise.reject(new Error('corrupt')),
      save: vi.fn(() => Promise.resolve()),
    };
    const service = await createDeviceStateService(store, onLoadError);
    expect(onLoadError).toHaveBeenCalledTimes(1);
    expect(service.get().recentProjects).toEqual([]);
  });
});
