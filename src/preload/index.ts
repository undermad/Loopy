import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { z } from 'zod';
import {
  IpcChannel,
  appSettingsSchema,
  appVersionSchema,
  assetPickResultSchema,
  assetsSnapshotSchema,
  boardListSchema,
  boardSchema,
  boardSnapshotSchema,
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
  paletteListSchema,
  paletteSchema,
  pickedColourSchema,
  projectInfoSchema,
  projectListSchema,
  projectStateSchema,
  shellStateSchema,
  themeListSchema,
  themeSchema,
  ticketsSnapshotSchema,
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
  getTickets: () => invoke(IpcChannel.ticketsSnapshot, ticketsSnapshotSchema),
  createTicket: (input) => invoke(IpcChannel.ticketsCreate, ticketsSnapshotSchema, input),
  updateTicket: (id, patch) => invoke(IpcChannel.ticketsUpdate, ticketsSnapshotSchema, id, patch),
  moveTicket: (move) => invoke(IpcChannel.ticketsMove, ticketsSnapshotSchema, move),
  deleteTicket: (id) => invoke(IpcChannel.ticketsDelete, ticketsSnapshotSchema, id),
  setTicketLabels: (id, labelIds) => invoke(IpcChannel.ticketsSetLabels, ticketsSnapshotSchema, id, labelIds),
  createState: (input) => invoke(IpcChannel.statesCreate, ticketsSnapshotSchema, input),
  updateState: (id, patch) => invoke(IpcChannel.statesUpdate, ticketsSnapshotSchema, id, patch),
  moveState: (id, position) => invoke(IpcChannel.statesMove, ticketsSnapshotSchema, id, position),
  deleteState: (id, moveTo) => invoke(IpcChannel.statesDelete, ticketsSnapshotSchema, id, moveTo),
  createLabel: (input) => invoke(IpcChannel.labelsCreate, ticketsSnapshotSchema, input),
  updateLabel: (id, patch) => invoke(IpcChannel.labelsUpdate, ticketsSnapshotSchema, id, patch),
  deleteLabel: (id) => invoke(IpcChannel.labelsDelete, ticketsSnapshotSchema, id),
  createSprint: (input) => invoke(IpcChannel.sprintsCreate, ticketsSnapshotSchema, input),
  updateSprint: (id, patch) => invoke(IpcChannel.sprintsUpdate, ticketsSnapshotSchema, id, patch),
  startSprint: (id) => invoke(IpcChannel.sprintsStart, ticketsSnapshotSchema, id),
  completeSprint: (input) => invoke(IpcChannel.sprintsComplete, ticketsSnapshotSchema, input),
  deleteSprint: (id) => invoke(IpcChannel.sprintsDelete, ticketsSnapshotSchema, id),
  createComment: (input) => invoke(IpcChannel.commentsCreate, ticketsSnapshotSchema, input),
  updateComment: (id, body) => invoke(IpcChannel.commentsUpdate, ticketsSnapshotSchema, id, body),
  deleteComment: (id) => invoke(IpcChannel.commentsDelete, ticketsSnapshotSchema, id),
  createTemplate: (input) => invoke(IpcChannel.templatesCreate, ticketsSnapshotSchema, input),
  updateTemplate: (id, patch) => invoke(IpcChannel.templatesUpdate, ticketsSnapshotSchema, id, patch),
  deleteTemplate: (id) => invoke(IpcChannel.templatesDelete, ticketsSnapshotSchema, id),
  listBoards: () => invoke(IpcChannel.boardsList, boardListSchema),
  createBoard: (input) => invoke(IpcChannel.boardsCreate, boardSchema, input),
  updateBoard: (id, patch) => invoke(IpcChannel.boardsUpdate, boardSchema, id, patch),
  deleteBoard: (id) => invoke(IpcChannel.boardsDelete, boardListSchema, id),
  readBoard: (id) => invoke(IpcChannel.boardsRead, boardSnapshotSchema, id),
  applyBoardChanges: (id, changes) => invoke(IpcChannel.boardsApplyChanges, boardSnapshotSchema, id, changes),
  listPalettes: () => invoke(IpcChannel.palettesList, paletteListSchema),
  createPalette: (input) => invoke(IpcChannel.palettesCreate, paletteSchema, input),
  updatePalette: (id, patch) => invoke(IpcChannel.palettesUpdate, paletteSchema, id, patch),
  deletePalette: (id) => invoke(IpcChannel.palettesDelete, paletteListSchema, id),
  getAssets: () => invoke(IpcChannel.assetsSnapshot, assetsSnapshotSchema),
  createAssetFolder: (input) => invoke(IpcChannel.assetsCreateFolder, assetsSnapshotSchema, input),
  updateAssetFolder: (id, patch) => invoke(IpcChannel.assetsUpdateFolder, assetsSnapshotSchema, id, patch),
  deleteAssetFolder: (id) => invoke(IpcChannel.assetsDeleteFolder, assetsSnapshotSchema, id),
  importAssets: (input) => invoke(IpcChannel.assetsImport, assetPickResultSchema, input),
  pickAssets: (target) => invoke(IpcChannel.assetsPick, assetPickResultSchema, target),
  updateAsset: (id, patch) => invoke(IpcChannel.assetsUpdate, assetsSnapshotSchema, id, patch),
  moveAssets: (ids, folderId) => invoke(IpcChannel.assetsMove, assetsSnapshotSchema, ids, folderId),
  deleteAssets: (ids) => invoke(IpcChannel.assetsDelete, assetsSnapshotSchema, ids),
  exportAsset: (id) => invoke(IpcChannel.assetsExport, exportResultSchema, id),
  setAssetSettings: (patch) => invoke(IpcChannel.assetsSettings, assetsSnapshotSchema, patch),
  pickScreenColour: () => invoke(IpcChannel.colourPickScreen, pickedColourSchema),
};

contextBridge.exposeInMainWorld('loopy', api);
