import { describe, expect, it, vi } from 'vitest';
import { IpcChannel } from '@shared/ipc';
import { getAppVersion, registerAppHandlers } from '../../../src/main/ipc/app';

describe('app IPC handlers', () => {
  it('registers the version handler on the expected channel', async () => {
    const ipc = { handle: vi.fn() };
    registerAppHandlers(ipc, { appVersion: '0.1.0', electronVersion: '44.8.0', quit: vi.fn() });

    const [channel, handler] = ipc.handle.mock.calls[0] as [string, () => unknown];
    expect(channel).toBe(IpcChannel.getAppVersion);
    await expect(Promise.resolve(handler())).resolves.toEqual({ app: '0.1.0', electron: '44.8.0' });
  });

  it('asks the app to quit through main so unsaved work is guarded', () => {
    const ipc = { handle: vi.fn() };
    const quit = vi.fn();
    registerAppHandlers(ipc, { appVersion: '0.1.0', electronVersion: '44.8.0', quit });

    const [channel, handler] = ipc.handle.mock.calls[1] as [string, () => unknown];
    expect(channel).toBe(IpcChannel.appQuit);
    handler();
    expect(quit).toHaveBeenCalledTimes(1);
  });

  it('validates the version payload against the shared schema', () => {
    expect(() => getAppVersion({ appVersion: '', electronVersion: '44.8.0' })).toThrow();
  });
});
