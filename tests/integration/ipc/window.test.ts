import { describe, expect, it, vi } from 'vitest';
import { IpcChannel } from '@shared/ipc';
import { registerWindowHandlers } from '../../../src/main/ipc/window';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

describe('window IPC handlers', () => {
  it('toggles fullscreen and forwards edit commands to the web contents', () => {
    const handlers = new Map<string, Handler>();
    let fullscreen = false;
    const window = {
      isFullScreen: () => fullscreen,
      setFullScreen: vi.fn((next: boolean) => {
        fullscreen = next;
      }),
      webContents: {
        undo: vi.fn(),
        redo: vi.fn(),
        cut: vi.fn(),
        copy: vi.fn(),
        paste: vi.fn(),
        delete: vi.fn(),
        selectAll: vi.fn(),
      },
    };
    const ipc = { handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler)) };
    registerWindowHandlers(ipc, { windowFor: () => window as never });

    expect(handlers.get(IpcChannel.windowToggleFullscreen)?.({})).toBe(true);
    expect(window.setFullScreen).toHaveBeenCalledWith(true);
    handlers.get(IpcChannel.windowEditCommand)?.({}, 'copy');
    expect(window.webContents.copy).toHaveBeenCalledTimes(1);
    expect(() => handlers.get(IpcChannel.windowEditCommand)?.({}, 'format')).toThrow();
  });

  it('returns false when no window is attached', () => {
    const handlers = new Map<string, Handler>();
    const ipc = { handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler)) };
    registerWindowHandlers(ipc, { windowFor: () => null });
    expect(handlers.get(IpcChannel.windowToggleFullscreen)?.({})).toBe(false);
  });
});
