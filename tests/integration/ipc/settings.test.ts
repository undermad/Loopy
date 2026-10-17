import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IpcChannel } from '@shared/ipc';
import { registerSettingsHandlers } from '../../../src/main/ipc/settings';
import { createAppSettingsStore } from '../../../src/main/storage';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

function fakeIpc() {
  const handlers = new Map<string, Handler>();
  return {
    handle: vi.fn((channel: string, handler: Handler) => {
      handlers.set(channel, handler);
    }),
    call: (channel: string, ...args: unknown[]) => {
      const handler = handlers.get(channel);
      if (!handler) throw new Error(`No handler for ${channel}`);
      return Promise.resolve(handler({}, ...args));
    },
  };
}

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-ipc-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('settings IPC handlers', () => {
  it('serves defaults, applies patches, persists them and broadcasts the change', async () => {
    const ipc = fakeIpc();
    const broadcast = vi.fn();
    const store = createAppSettingsStore(join(directory, 'settings.json'));
    const service = await registerSettingsHandlers(ipc, { store, broadcast });

    await expect(ipc.call(IpcChannel.settingsGet)).resolves.toEqual(store.defaults());

    const updated = await ipc.call(IpcChannel.settingsSet, { fontSize: 18, theme: { mode: 'dark' } });
    expect(updated).toMatchObject({ fontSize: 18, theme: { mode: 'dark', light: 'light', dark: 'dark' } });
    expect(service.current()).toEqual(updated);
    expect(broadcast).toHaveBeenCalledWith(IpcChannel.settingsChanged, updated);
    await expect(store.load()).resolves.toEqual(updated);
  });

  it('rejects an invalid patch without changing anything', async () => {
    const ipc = fakeIpc();
    const store = createAppSettingsStore(join(directory, 'settings.json'));
    await registerSettingsHandlers(ipc, { store, broadcast: vi.fn() });

    await expect(ipc.call(IpcChannel.settingsSet, { fontSize: 99 })).rejects.toThrow();
    await expect(ipc.call(IpcChannel.settingsGet)).resolves.toEqual(store.defaults());
  });

  it('falls back to defaults and reports a corrupt file', async () => {
    const ipc = fakeIpc();
    const onLoadError = vi.fn();
    const store = {
      path: 'x',
      defaults: () => createAppSettingsStore('x').defaults(),
      load: () => Promise.reject(new Error('corrupt')),
      save: vi.fn(() => Promise.resolve()),
    };
    await registerSettingsHandlers(ipc, { store, broadcast: vi.fn(), onLoadError });

    expect(onLoadError).toHaveBeenCalledTimes(1);
    await expect(ipc.call(IpcChannel.settingsGet)).resolves.toEqual(store.defaults());
  });
});
