import { z } from 'zod';
import { appSettingsSchema, type AppSettings, type AppSettingsPatch } from './app-settings';
import { recentProjectSchema } from './device-state';
import {
  layoutPresetSchema,
  workspacesSchema,
  type LayoutPreset,
  layoutNodeSchema,
  type LayoutNode,
} from './layout';
import { projectInfoSchema, recoverableProjectSchema, type ProjectInfo } from './project';
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
  cardTemplateListSchema,
  cardTemplateSchema,
  savedCardListSchema,
  savedCardSchema,
  type CardTemplate,
  type CardTemplateInput,
  type CardTemplatePatch,
  type SavedCard,
  type SavedCardInput,
  type SavedCardPatch,
} from './cards';
import {
  itemStylePresetListSchema,
  itemStylePresetSchema,
  type ItemStylePreset,
  type ItemStylePresetInput,
  type ItemStylePresetPatch,
} from './item-styles';
import {
  boardListSchema,
  boardSchema,
  boardSnapshotSchema,
  boardTileListSchema,
  type Board,
  type BoardChanges,
  type BoardInput,
  type BoardPatch,
  type BoardSnapshot,
  type BoardTile,
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
import {
  noteImportResultSchema,
  noteListSchema,
  noteSchema,
  noteVersionListSchema,
  type Note,
  type NoteExport,
  type NoteImport,
  type NoteImportResult,
  type NoteInput,
  type NotePatch,
  type NoteVersion,
} from './notes';

export const IpcChannel = {
  getAppVersion: 'app:getVersion',
  appQuit: 'app:quit',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  settingsChanged: 'settings:changed',
  shellGetNativeTheme: 'shell:getNativeTheme',
  shellNativeThemeChanged: 'shell:nativeThemeChanged',
  shellGetLocale: 'shell:getLocale',
  windowToggleFullscreen: 'window:toggleFullscreen',
  windowEditCommand: 'window:editCommand',
  windowDetachArea: 'window:detachArea',
  windowDetachedLayout: 'window:detachedLayout',
  windowReturnLayout: 'window:returnLayout',
  windowLayoutReturned: 'window:layoutReturned',
  projectDataChanged: 'project:dataChanged',
  themesList: 'themes:list',
  themesSave: 'themes:save',
  themesDelete: 'themes:delete',
  themesExport: 'themes:export',
  themesImport: 'themes:import',
  projectList: 'project:list',
  projectCreate: 'project:create',
  projectOpen: 'project:open',
  projectOpenRecent: 'project:openRecent',
  projectClose: 'project:close',
  projectState: 'project:state',
  projectSave: 'project:save',
  projectSaveAs: 'project:saveAs',
  projectRename: 'project:rename',
  projectRecover: 'project:recover',
  projectDiscardRecovery: 'project:discardRecovery',
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
  boardsReadTiles: 'boardTiles:list',
  palettesList: 'palettes:list',
  palettesCreate: 'palettes:create',
  palettesUpdate: 'palettes:update',
  palettesDelete: 'palettes:delete',
  paletteClustersList: 'paletteClusters:list',
  paletteClustersCreate: 'paletteClusters:create',
  paletteClustersUpdate: 'paletteClusters:update',
  paletteClustersDelete: 'paletteClusters:delete',
  cardTemplatesList: 'cardTemplates:list',
  cardTemplatesCreate: 'cardTemplates:create',
  cardTemplatesUpdate: 'cardTemplates:update',
  cardTemplatesDelete: 'cardTemplates:delete',
  cardsList: 'cards:list',
  cardsCreate: 'cards:create',
  cardsUpdate: 'cards:update',
  cardsDelete: 'cards:delete',
  itemStylesList: 'itemStyles:list',
  itemStylesCreate: 'itemStyles:create',
  itemStylesUpdate: 'itemStyles:update',
  itemStylesDelete: 'itemStyles:delete',
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
  notesList: 'notes:list',
  notesCreate: 'notes:create',
  notesUpdate: 'notes:update',
  notesDelete: 'notes:delete',
  notesImport: 'notes:import',
  notesPick: 'notes:pick',
  notesExport: 'notes:export',
  notesMerge: 'notes:merge',
  noteVersionsList: 'noteVersions:list',
  noteVersionsRestore: 'noteVersions:restore',
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
export const projectPathSchema = z.string().min(1);
export const recentProjectEntrySchema = recentProjectSchema.extend({ missing: z.boolean() });
export const projectListSchema = z.array(recentProjectEntrySchema);
export const projectStateSchema = z.object({
  current: projectInfoSchema.nullable(),
  path: projectPathSchema.nullable(),
  dirty: z.boolean(),
  recent: z.array(recentProjectSchema),
  recoverable: z.array(recoverableProjectSchema),
});

export const openProjectResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('opened'), project: projectInfoSchema }),
  z.object({ status: z.literal('cancelled') }),
  z.object({ status: z.literal('failed'), code: projectFailureCodeSchema }),
]);

export const saveProjectResultSchema = z.object({ status: z.enum(['saved', 'cancelled', 'failed']) });

export const shellStateSchema = z.object({ workspaces: workspacesSchema.nullable(), statusBar: z.boolean() });
export const shellStatePatchSchema = shellStateSchema.partial();

export { appSettingsSchema, layoutPresetSchema, projectInfoSchema, themeSchema };

export type AppVersion = z.infer<typeof appVersionSchema>;
export type ColorScheme = z.infer<typeof colorSchemeSchema>;
export type ExportResult = z.infer<typeof exportResultSchema>;
export type ImportThemeResult = z.infer<typeof importThemeResultSchema>;
export type ImportLayoutResult = z.infer<typeof importLayoutResultSchema>;
export type ProjectFailureCode = z.infer<typeof projectFailureCodeSchema>;
export type RecentProjectEntry = z.infer<typeof recentProjectEntrySchema>;
export type ProjectState = z.infer<typeof projectStateSchema>;
export type OpenProjectResult = z.infer<typeof openProjectResultSchema>;
export type SaveProjectResult = z.infer<typeof saveProjectResultSchema>;
export type ShellState = z.infer<typeof shellStateSchema>;
export type ShellStatePatch = z.infer<typeof shellStatePatchSchema>;
export type EditCommand = z.infer<typeof editCommandSchema>;
export type Unsubscribe = () => void;

export const DATA_DOMAINS = ['tickets', 'boards', 'palettes', 'cards', 'styles', 'assets', 'notes'] as const;
export type DataDomain = (typeof DATA_DOMAINS)[number];
export const dataChangeSchema = z.object({ domain: z.enum(DATA_DOMAINS) });
export type DataChange = z.infer<typeof dataChangeSchema>;

export const detachAreaSchema = z.object({
  layout: layoutNodeSchema,
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});
export type DetachArea = z.infer<typeof detachAreaSchema>;
export const detachedLayoutSchema = layoutNodeSchema.nullable();

export interface LoopyApi {
  getAppVersion: () => Promise<AppVersion>;
  quitApp: () => Promise<void>;
  getSettings: () => Promise<AppSettings>;
  setSettings: (patch: AppSettingsPatch) => Promise<AppSettings>;
  onSettingsChanged: (listener: (settings: AppSettings) => void) => Unsubscribe;
  getNativeTheme: () => Promise<ColorScheme>;
  onNativeThemeChanged: (listener: (scheme: ColorScheme) => void) => Unsubscribe;
  getLocale: () => Promise<string>;
  toggleFullscreen: () => Promise<boolean>;
  editCommand: (command: EditCommand) => Promise<void>;
  detachArea: (input: DetachArea) => Promise<void>;
  getDetachedLayout: () => Promise<LayoutNode | null>;
  returnLayout: (layout: LayoutNode) => Promise<void>;
  onLayoutReturned: (listener: (layout: LayoutNode) => void) => Unsubscribe;
  onProjectDataChanged: (listener: (change: DataChange) => void) => Unsubscribe;
  listThemes: () => Promise<Theme[]>;
  saveTheme: (theme: Theme) => Promise<Theme>;
  deleteTheme: (id: string) => Promise<void>;
  exportTheme: (id: string) => Promise<ExportResult>;
  importTheme: () => Promise<ImportThemeResult>;
  listProjects: () => Promise<RecentProjectEntry[]>;
  createProject: (name: string) => Promise<OpenProjectResult>;
  openProject: () => Promise<OpenProjectResult>;
  openRecentProject: (path: string) => Promise<OpenProjectResult>;
  closeProject: () => Promise<void>;
  getProjectState: () => Promise<ProjectState>;
  saveProject: () => Promise<SaveProjectResult>;
  saveProjectAs: () => Promise<SaveProjectResult>;
  renameProject: (name: string) => Promise<ProjectInfo>;
  recoverProject: (id: string) => Promise<OpenProjectResult>;
  discardRecovery: (id: string) => Promise<ProjectState>;
  revealProject: (path: string) => Promise<void>;
  removeRecentProject: (path: string) => Promise<ProjectState>;
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
  readBoardTiles: (id: string) => Promise<BoardTile[]>;
  listPalettes: () => Promise<Palette[]>;
  createPalette: (input: PaletteInput) => Promise<Palette>;
  updatePalette: (id: string, patch: PalettePatch) => Promise<Palette>;
  deletePalette: (id: string) => Promise<Palette[]>;
  listPaletteClusters: () => Promise<PaletteCluster[]>;
  createPaletteCluster: (input: PaletteClusterInput) => Promise<PaletteLibrary>;
  updatePaletteCluster: (id: string, patch: PaletteClusterPatch) => Promise<PaletteCluster>;
  deletePaletteCluster: (id: string, withPalettes: boolean) => Promise<PaletteLibrary>;
  listCardTemplates: () => Promise<CardTemplate[]>;
  createCardTemplate: (input: CardTemplateInput) => Promise<CardTemplate>;
  updateCardTemplate: (id: string, patch: CardTemplatePatch) => Promise<CardTemplate>;
  deleteCardTemplate: (id: string) => Promise<CardTemplate[]>;
  listCards: () => Promise<SavedCard[]>;
  createCard: (input: SavedCardInput) => Promise<SavedCard>;
  updateCard: (id: string, patch: SavedCardPatch) => Promise<SavedCard>;
  deleteCard: (id: string) => Promise<SavedCard[]>;
  listItemStyles: () => Promise<ItemStylePreset[]>;
  createItemStyle: (input: ItemStylePresetInput) => Promise<ItemStylePreset>;
  updateItemStyle: (id: string, patch: ItemStylePresetPatch) => Promise<ItemStylePreset>;
  deleteItemStyle: (id: string) => Promise<ItemStylePreset[]>;
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
  listNotes: () => Promise<Note[]>;
  createNote: (input: NoteInput) => Promise<Note>;
  updateNote: (id: string, patch: NotePatch) => Promise<Note[]>;
  deleteNotes: (ids: string[]) => Promise<Note[]>;
  importNotes: (input: NoteImport) => Promise<NoteImportResult>;
  pickNotes: (mode: NotePickMode, folderId: string | null) => Promise<NoteImportResult>;
  exportNotes: (input: NoteExport) => Promise<ExportResult>;
  mergeNotes: (sourceId: string, targetId: string) => Promise<Note[]>;
  listNoteVersions: (noteId: string) => Promise<NoteVersion[]>;
  restoreNoteVersion: (versionId: string) => Promise<Note[]>;
  pickScreenColour: () => Promise<string | null>;
}

export const notePickModeSchema = z.enum(['files', 'folder']);
export type NotePickMode = z.infer<typeof notePickModeSchema>;

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
  boardTileListSchema,
  paletteClusterListSchema,
  paletteClusterSchema,
  cardTemplateListSchema,
  cardTemplateSchema,
  savedCardListSchema,
  savedCardSchema,
  itemStylePresetListSchema,
  itemStylePresetSchema,
  paletteLibrarySchema,
  paletteListSchema,
  paletteSchema,
  ticketsSnapshotSchema,
  noteImportResultSchema,
  noteListSchema,
  noteSchema,
  noteVersionListSchema,
};
