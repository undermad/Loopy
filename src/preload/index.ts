import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { z } from 'zod';
import {
  IpcChannel,
  appSettingsSchema,
  appVersionSchema,
  colorSchemeSchema,
  exportResultSchema,
  importThemeResultSchema,
  localeSchema,
  themeListSchema,
  themeSchema,
  type LoopyApi,
  type Unsubscribe,
} from '@shared/ipc';

function subscribe<T>(channel: string, schema: z.ZodType<T>, listener: (value: T) => void): Unsubscribe {
  const handler = (_event: IpcRendererEvent, payload: unknown) => {
    listener(schema.parse(payload));
  };
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

async function invoke<T>(channel: string, schema: z.ZodType<T>, ...args: unknown[]): Promise<T> {
  return schema.parse(await ipcRenderer.invoke(channel, ...args));
}

const api: LoopyApi = {
  getAppVersion: () => invoke(IpcChannel.getAppVersion, appVersionSchema),
  getSettings: () => invoke(IpcChannel.settingsGet, appSettingsSchema),
  setSettings: (patch) => invoke(IpcChannel.settingsSet, appSettingsSchema, patch),
  onSettingsChanged: (listener) => subscribe(IpcChannel.settingsChanged, appSettingsSchema, listener),
  getNativeTheme: () => invoke(IpcChannel.shellGetNativeTheme, colorSchemeSchema),
  onNativeThemeChanged: (listener) =>
    subscribe(IpcChannel.shellNativeThemeChanged, colorSchemeSchema, listener),
  getLocale: () => invoke(IpcChannel.shellGetLocale, localeSchema),
  listThemes: () => invoke(IpcChannel.themesList, themeListSchema),
  saveTheme: (theme) => invoke(IpcChannel.themesSave, themeSchema, theme),
  deleteTheme: async (id) => {
    await ipcRenderer.invoke(IpcChannel.themesDelete, id);
  },
  exportTheme: (id) => invoke(IpcChannel.themesExport, exportResultSchema, id),
  importTheme: () => invoke(IpcChannel.themesImport, importThemeResultSchema),
};

contextBridge.exposeInMainWorld('loopy', api);
