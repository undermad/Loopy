import { z } from 'zod';
import { appSettingsSchema, type AppSettings, type AppSettingsPatch } from './app-settings';
import { recentProjectSchema } from './device-state';
import { layoutPresetSchema, workspacesSchema, type LayoutPreset } from './layout';
import { projectInfoSchema, projectNameSchema, type ProjectInfo } from './project';
import { hexColorSchema, themeSchema, type Theme } from './theme';
import {
  assetPickResultSchema,
  assetsSnapshotSchema,
  type AssetImport,
  type AssetPatch,
  type AssetPickResult,
  type AssetSettingsPatch,
  type AssetsSnapshot,
  type AssetTarget,
  type FolderInput,
  type FolderPatch,
} from './assets';
import {
  paletteClusterListSchema,
  paletteClusterSchema,
  paletteLibrarySchema,
  paletteListSchema,
  paletteSchema,
  type Palette,
  type PaletteCluster,
  type PaletteClusterInput,
  type PaletteClusterPatch,
  type PaletteInput,
  type PaletteLibrary,
  type PalettePatch,
} from './colours';
import {
  boardListSchema,
  boardSchema,
  boardSnapshotSchema,
  type Board,
  type BoardChanges,
  type BoardInput,
  type BoardPatch,
  type BoardSnapshot,
} from './board';
import {
  ticketsSnapshotSchema,
  type CommentInput,
  type LabelInput,
  type LabelPatch,
  type StateInput,
  type SprintComplete,
  type SprintInput,
  type SprintPatch,
  type StatePatch,
  type TemplateInput,
  type TemplatePatch,
  type TicketInput,
  type TicketMove,
  type TicketPatch,
  type TicketsSnapshot,
} from './tickets';

export const IpcChannel = {
  getAppVersion: 'app:getVersion',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  settingsChanged: 'settings:changed',
  shellGetNativeTheme: 'shell:getNativeTheme',
  shellNativeThemeChanged: 'shell:nativeThemeChanged',
  shellGetLocale: 'shell:getLocale',
  windowToggleFullscreen: 'window:toggleFullscreen',
  windowEditCommand: 'window:editCommand',
  themesList: 'themes:list',
  themesSave: 'themes:save',
  themesDelete: 'themes:delete',
  themesExport: 'themes:export',
  themesImport: 'themes:import',
  projectList: 'project:list',
  projectCreate: 'project:create',
  projectOpen: 'project:open',
  projectClose: 'project:close',
  projectState: 'project:state',
  projectImport: 'project:import',
  projectExport: 'project:export',
  projectDelete: 'project:delete',
  projectReveal: 'project:reveal',
  projectRemoveRecent: 'project:removeRecent',
  projectChanged: 'project:changed',
  stateGet: 'state:get',
  stateSet: 'state:set',
  layoutsList: 'layouts:list',
  layoutsSave: 'layouts:save',
  layoutsDelete: 'layouts:delete',
  layoutsExport: 'layouts:export',
  layoutsImport: 'layouts:import',
  ticketsSnapshot: 'tickets:snapshot',
  ticketsCreate: 'tickets:create',
  ticketsUpdate: 'tickets:update',
  ticketsMove: 'tickets:move',
  ticketsDelete: 'tickets:delete',
  ticketsSetLabels: 'tickets:setLabels',
  statesCreate: 'states:create',
  statesUpdate: 'states:update',
  statesMove: 'states:move',
  statesDelete: 'states:delete',
  labelsCreate: 'labels:create',
  labelsUpdate: 'labels:update',
  labelsDelete: 'labels:delete',
  sprintsCreate: 'sprints:create',
  sprintsUpdate: 'sprints:update',
  sprintsStart: 'sprints:start',
  sprintsComplete: 'sprints:complete',
  sprintsDelete: 'sprints:delete',
  commentsCreate: 'comments:create',
  commentsUpdate: 'comments:update',
  commentsDelete: 'comments:delete',
  templatesCreate: 'templates:create',
  templatesUpdate: 'templates:update',
  templatesDelete: 'templates:delete',
  boardsList: 'boards:list',
  boardsCreate: 'boards:create',
  boardsUpdate: 'boards:update',
  boardsDelete: 'boards:delete',
  boardsRead: 'boards:read',
  boardsApplyChanges: 'boards:applyChanges',
  palettesList: 'palettes:list',
  palettesCreate: 'palettes:create',
  palettesUpdate: 'palettes:update',
  palettesDelete: 'palettes:delete',
  paletteClustersList: 'paletteClusters:list',
  paletteClustersCreate: 'paletteClusters:create',
  paletteClustersUpdate: 'paletteClusters:update',
  paletteClustersDelete: 'paletteClusters:delete',
  assetsSnapshot: 'assets:snapshot',
  assetsCreateFolder: 'assets:createFolder',
  assetsUpdateFolder: 'assets:updateFolder',
  assetsDeleteFolder: 'assets:deleteFolder',
  assetsImport: 'assets:import',
  assetsPick: 'assets:pick',
  assetsUpdate: 'assets:update',
  assetsMove: 'assets:move',
  assetsDelete: 'assets:delete',
  assetsExport: 'assets:export',
  assetsSettings: 'assets:settings',
  colourPickScreen: 'colour:pickScreen',
  pickerStart: 'picker:start',
  pickerDone: 'picker:done',
} as const;

export const appVersionSchema = z.object({ app: z.string().min(1), electron: z.string().min(1) });
export const colorSchemeSchema = z.enum(['light', 'dark']);
export const localeSchema = z.string().min(2);
export const themeIdSchema = z.string().min(1);
export const themeListSchema = z.array(themeSchema);
export const projectIdSchema = z.uuid();
export const layoutIdSchema = z.string().min(1);
export const layoutListSchema = z.array(layoutPresetSchema);
export const booleanSchema = z.boolean();
export const editCommandSchema = z.enum(['undo', 'redo', 'cut', 'copy', 'paste', 'delete', 'selectAll']);
export const pickedColourSchema = hexColorSchema.nullable();

export const exportResultSchema = z.object({ status: z.enum(['exported', 'cancelled']) });

export const importThemeResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('imported'), theme: themeSchema }),
  z.object({ status: z.literal('cancelled') }),
  z.object({ status: z.literal('invalid') }),
]);

export const importLayoutResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('imported'), layout: layoutPresetSchema }),
  z.object({ status: z.literal('cancelled') }),
  z.object({ status: z.literal('invalid') }),
]);

export const projectFailureCodeSchema = z.enum([
  'NOT_FOUND',
  'NOT_A_PROJECT',
  'UNSUPPORTED_VERSION',
  'CORRUPT',
]);
export const projectSummarySchema = projectInfoSchema.extend({ lastOpenedAt: z.iso.datetime().optional() });
export const projectListSchema = z.array(projectSummarySchema);
export const projectStateSchema = z.object({
  current: projectInfoSchema.nullable(),
  recent: z.array(recentProjectSchema),
});

export const openProjectResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('opened'), project: projectInfoSchema }),
  z.object({ status: z.literal('failed'), code: projectFailureCodeSchema }),
]);

export const importProjectResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('imported'), project: projectInfoSchema }),
  z.object({ status: z.literal('cancelled') }),
  z.object({ status: z.literal('failed'), code: projectFailureCodeSchema }),
]);

export const shellStateSchema = z.object({ workspaces: workspacesSchema.nullable(), statusBar: z.boolean() });
export const shellStatePatchSchema = shellStateSchema.partial();

export { appSettingsSchema, layoutPresetSchema, projectInfoSchema, projectNameSchema, themeSchema };

export type AppVersion = z.infer<typeof appVersionSchema>;
export type ColorScheme = z.infer<typeof colorSchemeSchema>;
export type ExportResult = z.infer<typeof exportResultSchema>;
export type ImportThemeResult = z.infer<typeof importThemeResultSchema>;
export type ImportLayoutResult = z.infer<typeof importLayoutResultSchema>;
export type ProjectFailureCode = z.infer<typeof projectFailureCodeSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type ProjectState = z.infer<typeof projectStateSchema>;
export type OpenProjectResult = z.infer<typeof openProjectResultSchema>;
export type ImportProjectResult = z.infer<typeof importProjectResultSchema>;
export type ShellState = z.infer<typeof shellStateSchema>;
export type ShellStatePatch = z.infer<typeof shellStatePatchSchema>;
export type EditCommand = z.infer<typeof editCommandSchema>;
export type Unsubscribe = () => void;

export interface LoopyApi {
  getAppVersion: () => Promise<AppVersion>;
  getSettings: () => Promise<AppSettings>;
  setSettings: (patch: AppSettingsPatch) => Promise<AppSettings>;
  onSettingsChanged: (listener: (settings: AppSettings) => void) => Unsubscribe;
  getNativeTheme: () => Promise<ColorScheme>;
  onNativeThemeChanged: (listener: (scheme: ColorScheme) => void) => Unsubscribe;
  getLocale: () => Promise<string>;
  toggleFullscreen: () => Promise<boolean>;
  editCommand: (command: EditCommand) => Promise<void>;
  listThemes: () => Promise<Theme[]>;
  saveTheme: (theme: Theme) => Promise<Theme>;
  deleteTheme: (id: string) => Promise<void>;
  exportTheme: (id: string) => Promise<ExportResult>;
  importTheme: () => Promise<ImportThemeResult>;
  listProjects: () => Promise<ProjectSummary[]>;
  createProject: (name: string) => Promise<ProjectInfo>;
  openProject: (id: string) => Promise<OpenProjectResult>;
  closeProject: () => Promise<void>;
  getProjectState: () => Promise<ProjectState>;
  importProject: () => Promise<ImportProjectResult>;
  exportProject: () => Promise<ExportResult>;
  deleteProject: (id: string) => Promise<void>;
  revealProject: (id: string) => Promise<void>;
  removeRecentProject: (id: string) => Promise<ProjectState>;
  onProjectChanged: (listener: (state: ProjectState) => void) => Unsubscribe;
  getShellState: () => Promise<ShellState>;
  setShellState: (patch: ShellStatePatch) => Promise<ShellState>;
  listLayouts: () => Promise<LayoutPreset[]>;
  saveLayout: (layout: LayoutPreset) => Promise<LayoutPreset>;
  deleteLayout: (id: string) => Promise<void>;
  exportLayout: (layout: LayoutPreset) => Promise<ExportResult>;
  importLayout: () => Promise<ImportLayoutResult>;
  getTickets: () => Promise<TicketsSnapshot>;
  createTicket: (input: TicketInput) => Promise<TicketsSnapshot>;
  updateTicket: (id: string, patch: TicketPatch) => Promise<TicketsSnapshot>;
  moveTicket: (move: TicketMove) => Promise<TicketsSnapshot>;
  deleteTicket: (id: string) => Promise<TicketsSnapshot>;
  setTicketLabels: (id: string, labelIds: string[]) => Promise<TicketsSnapshot>;
  createState: (input: StateInput) => Promise<TicketsSnapshot>;
  updateState: (id: string, patch: StatePatch) => Promise<TicketsSnapshot>;
  moveState: (id: string, position: string) => Promise<TicketsSnapshot>;
  deleteState: (id: string, moveTo: string | null) => Promise<TicketsSnapshot>;
  createLabel: (input: LabelInput) => Promise<TicketsSnapshot>;
  updateLabel: (id: string, patch: LabelPatch) => Promise<TicketsSnapshot>;
  deleteLabel: (id: string) => Promise<TicketsSnapshot>;
  createSprint: (input: SprintInput) => Promise<TicketsSnapshot>;
  updateSprint: (id: string, patch: SprintPatch) => Promise<TicketsSnapshot>;
  startSprint: (id: string) => Promise<TicketsSnapshot>;
  completeSprint: (input: SprintComplete) => Promise<TicketsSnapshot>;
  deleteSprint: (id: string) => Promise<TicketsSnapshot>;
  createComment: (input: CommentInput) => Promise<TicketsSnapshot>;
  updateComment: (id: string, body: string) => Promise<TicketsSnapshot>;
  deleteComment: (id: string) => Promise<TicketsSnapshot>;
  createTemplate: (input: TemplateInput) => Promise<TicketsSnapshot>;
  updateTemplate: (id: string, patch: TemplatePatch) => Promise<TicketsSnapshot>;
  deleteTemplate: (id: string) => Promise<TicketsSnapshot>;
  listBoards: () => Promise<Board[]>;
  createBoard: (input: BoardInput) => Promise<Board>;
  updateBoard: (id: string, patch: BoardPatch) => Promise<Board>;
  deleteBoard: (id: string) => Promise<Board[]>;
  readBoard: (id: string) => Promise<BoardSnapshot>;
  applyBoardChanges: (id: string, changes: BoardChanges) => Promise<BoardSnapshot>;
  listPalettes: () => Promise<Palette[]>;
  createPalette: (input: PaletteInput) => Promise<Palette>;
  updatePalette: (id: string, patch: PalettePatch) => Promise<Palette>;
  deletePalette: (id: string) => Promise<Palette[]>;
  listPaletteClusters: () => Promise<PaletteCluster[]>;
  createPaletteCluster: (input: PaletteClusterInput) => Promise<PaletteLibrary>;
  updatePaletteCluster: (id: string, patch: PaletteClusterPatch) => Promise<PaletteCluster>;
  deletePaletteCluster: (id: string, withPalettes: boolean) => Promise<PaletteLibrary>;
  getAssets: () => Promise<AssetsSnapshot>;
  createAssetFolder: (input: FolderInput) => Promise<AssetsSnapshot>;
  updateAssetFolder: (id: string, patch: FolderPatch) => Promise<AssetsSnapshot>;
  deleteAssetFolder: (id: string) => Promise<AssetsSnapshot>;
  importAssets: (input: AssetImport) => Promise<AssetPickResult>;
  pickAssets: (target: AssetTarget) => Promise<AssetPickResult>;
  updateAsset: (id: string, patch: AssetPatch) => Promise<AssetsSnapshot>;
  moveAssets: (ids: string[], folderId: string | null) => Promise<AssetsSnapshot>;
  deleteAssets: (ids: string[]) => Promise<AssetsSnapshot>;
  exportAsset: (id: string) => Promise<ExportResult>;
  setAssetSettings: (patch: AssetSettingsPatch) => Promise<AssetsSnapshot>;
  pickScreenColour: () => Promise<string | null>;
}

export const entityIdSchema = z.string().min(1);
export const labelIdsSchema = z.array(entityIdSchema);
export const positionSchema = z.string().min(1);
export const commentBodySchema = z.string().min(1).max(20_000);

export {
  assetPickResultSchema,
  assetsSnapshotSchema,
  boardListSchema,
  boardSchema,
  boardSnapshotSchema,
  paletteClusterListSchema,
  paletteClusterSchema,
  paletteLibrarySchema,
  paletteListSchema,
  paletteSchema,
  ticketsSnapshotSchema,
};
