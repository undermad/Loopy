import { describe, expect, it, vi } from 'vitest';
import { IpcChannel } from '@shared/ipc';
import type { AreaNode } from '@shared/layout';
import { registerWindowHandlers } from '../../../src/main/ipc/window';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

function deps() {
  return { detach: vi.fn(), layoutFor: vi.fn(() => null), returnLayout: vi.fn() };
}

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
    registerWindowHandlers(ipc, { ...deps(), windowFor: () => window as never });

    expect(handlers.get(IpcChannel.windowToggleFullscreen)?.({})).toBe(true);
    expect(window.setFullScreen).toHaveBeenCalledWith(true);
    handlers.get(IpcChannel.windowEditCommand)?.({}, 'copy');
    expect(window.webContents.copy).toHaveBeenCalledTimes(1);
    expect(() => handlers.get(IpcChannel.windowEditCommand)?.({}, 'format')).toThrow();
  });

  it('returns false when no window is attached', () => {
    const handlers = new Map<string, Handler>();
    const ipc = { handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler)) };
    registerWindowHandlers(ipc, { ...deps(), windowFor: () => null });
    expect(handlers.get(IpcChannel.windowToggleFullscreen)?.({})).toBe(false);
  });

  it('detaches an area into a window, hands it its layout and returns it', () => {
    const handlers = new Map<string, Handler>();
    const ipc = { handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler)) };
    const area: AreaNode = { kind: 'area', id: 'a', editor: 'board', state: {} };
    const fakes = { detach: vi.fn(), layoutFor: vi.fn(() => area), returnLayout: vi.fn() };
    registerWindowHandlers(ipc, { ...fakes, windowFor: () => null });

    handlers.get(IpcChannel.windowDetachArea)?.({}, { layout: area, x: 10, y: 20, width: 400, height: 300 });
    expect(fakes.detach).toHaveBeenCalledWith({ layout: area, x: 10, y: 20, width: 400, height: 300 });
    expect(() =>
      handlers.get(IpcChannel.windowDetachArea)?.({}, { layout: area, x: 0, y: 0, width: 0, height: 1 }),
    ).toThrow();
    expect(handlers.get(IpcChannel.windowDetachedLayout)?.({})).toEqual(area);
    const event = { sender: { id: 3 } };
    handlers.get(IpcChannel.windowReturnLayout)?.(event, area);
    expect(fakes.returnLayout).toHaveBeenCalledWith(event, area);
    expect(() => handlers.get(IpcChannel.windowReturnLayout)?.(event, { kind: 'nope' })).toThrow();
  });
});
