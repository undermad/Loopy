import type { IpcMain } from 'electron';
import { IpcChannel, appVersionSchema, type AppVersion } from '@shared/ipc';

export interface AppInfo {
  appVersion: string;
  electronVersion: string;
}

export interface AppHandlerDeps extends AppInfo {
  quit: () => void;
}

export function getAppVersion(info: AppInfo): AppVersion {
  return appVersionSchema.parse({ app: info.appVersion, electron: info.electronVersion });
}

export function registerAppHandlers(ipc: Pick<IpcMain, 'handle'>, deps: AppHandlerDeps): void {
  ipc.handle(IpcChannel.getAppVersion, () => getAppVersion(deps));
  ipc.handle(IpcChannel.appQuit, () => {
    deps.quit();
  });
}
