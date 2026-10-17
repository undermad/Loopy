import type { IpcMain } from 'electron';
import { appSettingsPatchSchema, appSettingsSchema, type AppSettings } from '@shared/app-settings';
import { IpcChannel } from '@shared/ipc';
import type { JsonStore } from '../storage/json-store';

export type Broadcast = (channel: string, payload: unknown) => void;

export interface SettingsHandlerDeps {
  store: JsonStore<AppSettings>;
  broadcast: Broadcast;
  onLoadError?: (error: unknown) => void;
}

export interface SettingsService {
  current(): AppSettings;
}

export async function registerSettingsHandlers(
  ipc: Pick<IpcMain, 'handle'>,
  deps: SettingsHandlerDeps,
): Promise<SettingsService> {
  let current: AppSettings;
  try {
    current = await deps.store.load();
  } catch (error) {
    deps.onLoadError?.(error);
    current = deps.store.defaults();
  }

  ipc.handle(IpcChannel.settingsGet, () => current);
  ipc.handle(IpcChannel.settingsSet, async (_event, raw: unknown) => {
    const patch = appSettingsPatchSchema.parse(raw);
    current = appSettingsSchema.parse({ ...current, ...patch });
    await deps.store.save(current);
    deps.broadcast(IpcChannel.settingsChanged, current);
    return current;
  });

  return { current: () => current };
}
