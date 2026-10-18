import { vi } from 'vitest';
import {
  APP_SETTINGS_SCHEMA_VERSION,
  appSettingsSchema,
  type AppSettings,
  type AppSettingsPatch,
} from '@shared/app-settings';
import type { RecentProject } from '@shared/device-state';
import type {
  DataChange,
  ColorScheme,
  LoopyApi,
  ProjectState,
  ProjectSummary,
  ShellState,
  ShellStatePatch,
} from '@shared/ipc';
import type { LayoutNode, LayoutPreset } from '@shared/layout';
import type { ProjectInfo } from '@shared/project';
import { builtInThemes, type Theme } from '@shared/theme';
import { bootstrap } from '@renderer/bootstrap';
import { resetProjectStore } from '@renderer/lib/project';
import { resetBoardStore } from '@renderer/lib/board';
import { resetTicketsStore } from '@renderer/lib/tickets';
import { resetWorkspacesStore } from '@renderer/lib/workspaces';
import { resetAssetsStore } from '@renderer/lib/assets';
import { resetCardTemplatesStore } from '@renderer/lib/cards';
import { resetBrushStore, resetTileCache } from '@renderer/lib/drawing';
import { resetNotesStore } from '@renderer/lib/notes';
import { resetPalettesStore } from '@renderer/lib/palettes';
import { resetSettingsStore } from '@renderer/lib/settings';
import { resetThemeStore } from '@renderer/lib/theme';
import { createAssetsFake } from './assets-fake';
import { createBoardsFake } from './boards-fake';
import { createCardsFake } from './cards-fake';
import { createNotesFake } from './notes-fake';
import { createPalettesFake } from './palettes-fake';
import { createTicketsFake } from './tickets-fake';

export interface FakeApi extends LoopyApi {
  settings: AppSettings;
  themes: Theme[];
  projects: ProjectSummary[];
  recent: RecentProject[];
  current: ProjectInfo | null;
  shell: ShellState;
  layouts: LayoutPreset[];
  tickets: ReturnType<typeof createTicketsFake>['data'];
  palettesData: ReturnType<typeof createPalettesFake>['data'];
  cardsData: ReturnType<typeof createCardsFake>['data'];
  assetsData: ReturnType<typeof createAssetsFake>['data'];
  notesData: ReturnType<typeof createNotesFake>['data'];
  emitSettings: (settings: AppSettings) => void;
  emitNativeTheme: (scheme: ColorScheme) => void;
  emitProject: () => void;
  detachedLayout: LayoutNode | null;
  emitLayoutReturned: (layout: LayoutNode) => void;
  emitDataChanged: (change: DataChange) => void;
}

export function makeProject(name: string, id = crypto.randomUUID()): ProjectInfo {
  const stamp = '2026-10-17T09:00:00.000Z';
  return { id, name, createdAt: stamp, updatedAt: stamp };
}

export function createFakeApi(overrides: Partial<AppSettings> = {}, scheme: ColorScheme = 'light'): FakeApi {
  const settingsListeners = new Set<(settings: AppSettings) => void>();
  const returnedListeners = new Set<(layout: LayoutNode) => void>();
  const dataListeners = new Set<(change: DataChange) => void>();
  const themeListeners = new Set<(scheme: ColorScheme) => void>();
  const projectListeners = new Set<(state: ProjectState) => void>();
  const projectState = (): ProjectState => ({ current: api.current, recent: api.recent });
  const ticketsFake = createTicketsFake();
  const boardsFake = createBoardsFake();
  const palettesFake = createPalettesFake();
  const cardsFake = createCardsFake();
  const assetsFake = createAssetsFake();
  const notesFake = createNotesFake();
  const api: FakeApi = {
    settings: appSettingsSchema.parse({ schemaVersion: APP_SETTINGS_SCHEMA_VERSION, ...overrides }),
    themes: [...builtInThemes],
    projects: [],
    recent: [],
    current: null,
    shell: { workspaces: null, statusBar: true },
    layouts: [],
    tickets: ticketsFake.data,
    palettesData: palettesFake.data,
    cardsData: cardsFake.data,
    assetsData: assetsFake.data,
    notesData: notesFake.data,
    ...ticketsFake.api,
    ...boardsFake.api,
    ...palettesFake.api,
    ...cardsFake.api,
    ...assetsFake.api,
    ...notesFake.api,
    getAppVersion: vi.fn(() => Promise.resolve({ app: '0.1.0', electron: '44.8.0' })),
    getSettings: vi.fn(() => Promise.resolve(api.settings)),
    setSettings: vi.fn((patch: AppSettingsPatch) => {
      api.settings = appSettingsSchema.parse({ ...api.settings, ...patch });
      return Promise.resolve(api.settings);
    }),
    onSettingsChanged: vi.fn((listener: (settings: AppSettings) => void) => {
      settingsListeners.add(listener);
      return () => settingsListeners.delete(listener);
    }),
    getNativeTheme: vi.fn(() => Promise.resolve(scheme)),
    onNativeThemeChanged: vi.fn((listener: (scheme: ColorScheme) => void) => {
      themeListeners.add(listener);
      return () => themeListeners.delete(listener);
    }),
    getLocale: vi.fn(() => Promise.resolve('en-GB')),
    listThemes: vi.fn(() => Promise.resolve(api.themes)),
    saveTheme: vi.fn((theme: Theme) => {
      api.themes = [...api.themes.filter((candidate) => candidate.id !== theme.id), theme];
      return Promise.resolve(theme);
    }),
    deleteTheme: vi.fn((id: string) => {
      api.themes = api.themes.filter((candidate) => candidate.id !== id);
      return Promise.resolve();
    }),
    exportTheme: vi.fn(() => Promise.resolve({ status: 'exported' as const })),
    importTheme: vi.fn(() => Promise.resolve({ status: 'cancelled' as const })),
    listProjects: vi.fn(() => Promise.resolve(api.projects)),
    createProject: vi.fn((name: string) => {
      const project = makeProject(name);
      api.projects = [project, ...api.projects];
      api.current = project;
      api.emitProject();
      return Promise.resolve(project);
    }),
    openProject: vi.fn((id: string) => {
      const project = api.projects.find((candidate) => candidate.id === id);
      if (!project) return Promise.resolve({ status: 'failed' as const, code: 'NOT_FOUND' as const });
      api.current = project;
      api.emitProject();
      return Promise.resolve({ status: 'opened' as const, project });
    }),
    closeProject: vi.fn(() => {
      api.current = null;
      api.emitProject();
      return Promise.resolve();
    }),
    getProjectState: vi.fn(() => Promise.resolve(projectState())),
    importProject: vi.fn(() => Promise.resolve({ status: 'cancelled' as const })),
    exportProject: vi.fn(() => Promise.resolve({ status: 'exported' as const })),
    deleteProject: vi.fn((id: string) => {
      api.projects = api.projects.filter((candidate) => candidate.id !== id);
      return Promise.resolve();
    }),
    revealProject: vi.fn(() => Promise.resolve()),
    removeRecentProject: vi.fn((id: string) => {
      api.recent = api.recent.filter((candidate) => candidate.id !== id);
      return Promise.resolve(projectState());
    }),
    onProjectChanged: vi.fn((listener: (state: ProjectState) => void) => {
      projectListeners.add(listener);
      return () => projectListeners.delete(listener);
    }),
    getShellState: vi.fn(() => Promise.resolve(api.shell)),
    setShellState: vi.fn((patch: ShellStatePatch) => {
      api.shell = {
        workspaces: patch.workspaces === undefined ? api.shell.workspaces : patch.workspaces,
        statusBar: patch.statusBar ?? api.shell.statusBar,
      };
      return Promise.resolve(api.shell);
    }),
    listLayouts: vi.fn(() => Promise.resolve(api.layouts)),
    saveLayout: vi.fn((layout: LayoutPreset) => {
      api.layouts = [...api.layouts.filter((candidate) => candidate.id !== layout.id), layout];
      return Promise.resolve(layout);
    }),
    deleteLayout: vi.fn((id: string) => {
      api.layouts = api.layouts.filter((candidate) => candidate.id !== id);
      return Promise.resolve();
    }),
    exportLayout: vi.fn(() => Promise.resolve({ status: 'exported' as const })),
    importLayout: vi.fn(() => Promise.resolve({ status: 'cancelled' as const })),
    toggleFullscreen: vi.fn(() => Promise.resolve(true)),
    pickScreenColour: vi.fn(() => Promise.resolve(null)),
    editCommand: vi.fn(() => Promise.resolve()),
    detachArea: vi.fn(() => Promise.resolve()),
    getDetachedLayout: vi.fn(() => Promise.resolve(api.detachedLayout)),
    returnLayout: vi.fn(() => Promise.resolve()),
    onLayoutReturned: vi.fn((listener: (layout: LayoutNode) => void) => {
      returnedListeners.add(listener);
      return () => {
        returnedListeners.delete(listener);
      };
    }),
    onProjectDataChanged: vi.fn((listener: (change: DataChange) => void) => {
      dataListeners.add(listener);
      return () => {
        dataListeners.delete(listener);
      };
    }),
    detachedLayout: null,
    emitLayoutReturned: (layout) => {
      returnedListeners.forEach((listener) => {
        listener(layout);
      });
    },
    emitDataChanged: (change) => {
      dataListeners.forEach((listener) => {
        listener(change);
      });
    },
    emitSettings: (settings) => {
      settingsListeners.forEach((listener) => {
        listener(settings);
      });
    },
    emitNativeTheme: (next) => {
      themeListeners.forEach((listener) => {
        listener(next);
      });
    },
    emitProject: () => {
      projectListeners.forEach((listener) => {
        listener(projectState());
      });
    },
  };
  return api;
}

export async function bootTestApp(
  overrides: Partial<AppSettings> = {},
  scheme: ColorScheme = 'light',
  prepare?: (api: FakeApi) => void,
) {
  resetSettingsStore();
  resetThemeStore();
  resetProjectStore();
  resetWorkspacesStore();
  resetTicketsStore();
  resetBoardStore();
  resetTileCache();
  resetBrushStore();
  resetPalettesStore();
  resetCardTemplatesStore();
  resetAssetsStore();
  resetNotesStore();
  const api = createFakeApi(overrides, scheme);
  prepare?.(api);
  window.loopy = api;
  await bootstrap(api);
  return api;
}
