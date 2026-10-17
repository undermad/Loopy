import { vi } from 'vitest';
import {
  APP_SETTINGS_SCHEMA_VERSION,
  appSettingsSchema,
  type AppSettings,
  type AppSettingsPatch,
} from '@shared/app-settings';
import type { RecentProject } from '@shared/device-state';
import type { ColorScheme, LoopyApi, ProjectState, ProjectSummary } from '@shared/ipc';
import type { ProjectInfo } from '@shared/project';
import { builtInThemes, type Theme } from '@shared/theme';
import { bootstrap } from '@renderer/bootstrap';
import { resetProjectStore } from '@renderer/lib/project';
import { resetSettingsStore } from '@renderer/lib/settings';
import { resetThemeStore } from '@renderer/lib/theme';

export interface FakeApi extends LoopyApi {
  settings: AppSettings;
  themes: Theme[];
  projects: ProjectSummary[];
  recent: RecentProject[];
  current: ProjectInfo | null;
  emitSettings: (settings: AppSettings) => void;
  emitNativeTheme: (scheme: ColorScheme) => void;
  emitProject: () => void;
}

export function makeProject(name: string, id = crypto.randomUUID()): ProjectInfo {
  const stamp = '2026-10-17T09:00:00.000Z';
  return { id, name, createdAt: stamp, updatedAt: stamp };
}

export function createFakeApi(overrides: Partial<AppSettings> = {}, scheme: ColorScheme = 'light'): FakeApi {
  const settingsListeners = new Set<(settings: AppSettings) => void>();
  const themeListeners = new Set<(scheme: ColorScheme) => void>();
  const projectListeners = new Set<(state: ProjectState) => void>();
  const projectState = (): ProjectState => ({ current: api.current, recent: api.recent });
  const api: FakeApi = {
    settings: appSettingsSchema.parse({ schemaVersion: APP_SETTINGS_SCHEMA_VERSION, ...overrides }),
    themes: [...builtInThemes],
    projects: [],
    recent: [],
    current: null,
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

export async function bootTestApp(overrides: Partial<AppSettings> = {}, scheme: ColorScheme = 'light') {
  resetSettingsStore();
  resetThemeStore();
  resetProjectStore();
  const api = createFakeApi(overrides, scheme);
  window.loopy = api;
  await bootstrap(api);
  return api;
}
