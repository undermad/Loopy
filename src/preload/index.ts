import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { z } from 'zod';
import {
  IpcChannel,
  appSettingsSchema,
  appVersionSchema,
  booleanSchema,
  colorSchemeSchema,
  exportResultSchema,
  importLayoutResultSchema,
  importProjectResultSchema,
  importThemeResultSchema,
  layoutListSchema,
  layoutPresetSchema,
  localeSchema,
  openProjectResultSchema,
  projectInfoSchema,
  projectListSchema,
  projectStateSchema,
  shellStateSchema,
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

async function call(channel: string, ...args: unknown[]): Promise<void> {
  await ipcRenderer.invoke(channel, ...args);
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
  toggleFullscreen: () => invoke(IpcChannel.windowToggleFullscreen, booleanSchema),
  editCommand: (command) => call(IpcChannel.windowEditCommand, command),
  listThemes: () => invoke(IpcChannel.themesList, themeListSchema),
  saveTheme: (theme) => invoke(IpcChannel.themesSave, themeSchema, theme),
  deleteTheme: (id) => call(IpcChannel.themesDelete, id),
  exportTheme: (id) => invoke(IpcChannel.themesExport, exportResultSchema, id),
  importTheme: () => invoke(IpcChannel.themesImport, importThemeResultSchema),
  listProjects: () => invoke(IpcChannel.projectList, projectListSchema),
  createProject: (name) => invoke(IpcChannel.projectCreate, projectInfoSchema, name),
  openProject: (id) => invoke(IpcChannel.projectOpen, openProjectResultSchema, id),
  closeProject: () => call(IpcChannel.projectClose),
  getProjectState: () => invoke(IpcChannel.projectState, projectStateSchema),
  importProject: () => invoke(IpcChannel.projectImport, importProjectResultSchema),
  exportProject: () => invoke(IpcChannel.projectExport, exportResultSchema),
  deleteProject: (id) => call(IpcChannel.projectDelete, id),
  revealProject: (id) => call(IpcChannel.projectReveal, id),
  removeRecentProject: (id) => invoke(IpcChannel.projectRemoveRecent, projectStateSchema, id),
  onProjectChanged: (listener) => subscribe(IpcChannel.projectChanged, projectStateSchema, listener),
  getShellState: () => invoke(IpcChannel.stateGet, shellStateSchema),
  setShellState: (patch) => invoke(IpcChannel.stateSet, shellStateSchema, patch),
  listLayouts: () => invoke(IpcChannel.layoutsList, layoutListSchema),
  saveLayout: (layout) => invoke(IpcChannel.layoutsSave, layoutPresetSchema, layout),
  deleteLayout: (id) => call(IpcChannel.layoutsDelete, id),
  exportLayout: (layout) => invoke(IpcChannel.layoutsExport, exportResultSchema, layout),
  importLayout: () => invoke(IpcChannel.layoutsImport, importLayoutResultSchema),
};

contextBridge.exposeInMainWorld('loopy', api);
