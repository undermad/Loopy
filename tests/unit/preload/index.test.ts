import { describe, expect, it, vi } from 'vitest';
import { IpcChannel, type LoopyApi } from '@shared/ipc';
import { lightTheme } from '@shared/theme';

const electronMock = vi.hoisted(() => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn() },
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

  it('passes arguments through for setSettings and saveTheme', async () => {
    electronMock.ipcRenderer.invoke.mockResolvedValueOnce({
      schemaVersion: 2,
      theme: { mode: 'dark', light: 'light', dark: 'dark' },
      language: 'en',
      uiFont: 'Inter',
      fontSize: 14,
      defaultLayoutId: 'default',
    });
    await api.setSettings({ fontSize: 14 });
    expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith(IpcChannel.settingsSet, { fontSize: 14 });

    electronMock.ipcRenderer.invoke.mockResolvedValueOnce(lightTheme);
    await expect(api.saveTheme(lightTheme)).resolves.toEqual(lightTheme);
  });

  it('subscribes to pushed events, validates payloads and unsubscribes', () => {
    const listener = vi.fn();
    const unsubscribe = api.onNativeThemeChanged(listener);

    const [channel, handler] = electronMock.ipcRenderer.on.mock.calls.at(-1) as [
      string,
      (event: unknown, payload: unknown) => void,
    ];
    expect(channel).toBe(IpcChannel.shellNativeThemeChanged);

    handler({}, 'dark');
    expect(listener).toHaveBeenCalledWith('dark');
    expect(() => {
      handler({}, 'sepia');
    }).toThrow();

    unsubscribe();
    expect(electronMock.ipcRenderer.removeListener).toHaveBeenCalledWith(channel, handler);
  });
});
