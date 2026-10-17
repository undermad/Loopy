import { describe, expect, it, vi } from 'vitest';
import { IpcChannel } from '@shared/ipc';
import { currentScheme, registerShellHandlers } from '../../../src/main/ipc/shell';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

describe('shell IPC handlers', () => {
  it('reports the native theme and locale and broadcasts theme updates', () => {
    const handlers = new Map<string, Handler>();
    const ipc = { handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler)) };
    const listeners: (() => void)[] = [];
    const nativeTheme = {
      shouldUseDarkColors: true,
      on: vi.fn((_event: string, listener: () => void) => {
        listeners.push(listener);
        return nativeTheme;
      }),
    };
    const broadcast = vi.fn();

    registerShellHandlers(ipc, { nativeTheme: nativeTheme as never, locale: 'en-GB', broadcast });

    expect(handlers.get(IpcChannel.shellGetNativeTheme)?.({})).toBe('dark');
    expect(handlers.get(IpcChannel.shellGetLocale)?.({})).toBe('en-GB');

    nativeTheme.shouldUseDarkColors = false;
    for (const listener of listeners) listener();
    expect(broadcast).toHaveBeenCalledWith(IpcChannel.shellNativeThemeChanged, 'light');
    expect(currentScheme({ shouldUseDarkColors: false })).toBe('light');
  });
});
