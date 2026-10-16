import { describe, expect, it, vi } from 'vitest';
import { IpcChannel, type LoopyApi } from '@shared/ipc';

const electronMock = vi.hoisted(() => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: vi.fn() },
}));

vi.mock('electron', () => electronMock);

await import('../../../src/preload/index');

const [exposedName, api] = electronMock.contextBridge.exposeInMainWorld.mock.calls[0] as [string, LoopyApi];

describe('preload API', () => {
  it('is exposed to the renderer as window.loopy', () => {
    expect(exposedName).toBe('loopy');
  });

  it('forwards getAppVersion over the IPC channel and validates the reply', async () => {
    electronMock.ipcRenderer.invoke.mockResolvedValueOnce({ app: '0.1.0', electron: '44.0.0' });

    await expect(api.getAppVersion()).resolves.toEqual({ app: '0.1.0', electron: '44.0.0' });
    expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith(IpcChannel.getAppVersion);
  });

  it('rejects a malformed reply from the main process', async () => {
    electronMock.ipcRenderer.invoke.mockResolvedValueOnce({ app: 123 });

    await expect(api.getAppVersion()).rejects.toThrow();
  });
});
