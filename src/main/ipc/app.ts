import type { IpcMain } from 'electron';
import { IpcChannel, appVersionSchema, type AppVersion } from '@shared/ipc';

export interface AppInfo {
  appVersion: string;
  electronVersion: string;
}

export function getAppVersion(info: AppInfo): AppVersion {
  return appVersionSchema.parse({ app: info.appVersion, electron: info.electronVersion });
}

export function registerAppHandlers(ipc: Pick<IpcMain, 'handle'>, info: AppInfo): void {
  ipc.handle(IpcChannel.getAppVersion, () => getAppVersion(info));
}
