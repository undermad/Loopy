import type { IpcMain, NativeTheme } from 'electron';
import { IpcChannel, colorSchemeSchema, type ColorScheme } from '@shared/ipc';
import type { Broadcast } from './settings';

export interface ShellHandlerDeps {
  nativeTheme: Pick<NativeTheme, 'shouldUseDarkColors' | 'on'>;
  locale: string;
  broadcast: Broadcast;
}

export function currentScheme(nativeTheme: Pick<NativeTheme, 'shouldUseDarkColors'>): ColorScheme {
  return colorSchemeSchema.parse(nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
}

export function registerShellHandlers(ipc: Pick<IpcMain, 'handle'>, deps: ShellHandlerDeps): void {
  ipc.handle(IpcChannel.shellGetNativeTheme, () => currentScheme(deps.nativeTheme));
  ipc.handle(IpcChannel.shellGetLocale, () => deps.locale);
  deps.nativeTheme.on('updated', () => {
    deps.broadcast(IpcChannel.shellNativeThemeChanged, currentScheme(deps.nativeTheme));
  });
}
