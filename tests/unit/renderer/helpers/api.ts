import { vi } from 'vitest';
import {
  APP_SETTINGS_SCHEMA_VERSION,
  appSettingsSchema,
  type AppSettings,
  type AppSettingsPatch,
} from '@shared/app-settings';
import type { ColorScheme, LoopyApi } from '@shared/ipc';
import { builtInThemes, type Theme } from '@shared/theme';
import { bootstrap } from '@renderer/bootstrap';
import { resetSettingsStore } from '@renderer/lib/settings';
import { resetThemeStore } from '@renderer/lib/theme';

export interface FakeApi extends LoopyApi {
  settings: AppSettings;
  themes: Theme[];
  emitSettings: (settings: AppSettings) => void;
  emitNativeTheme: (scheme: ColorScheme) => void;
}

export function createFakeApi(overrides: Partial<AppSettings> = {}, scheme: ColorScheme = 'light'): FakeApi {
  const settingsListeners = new Set<(settings: AppSettings) => void>();
  const themeListeners = new Set<(scheme: ColorScheme) => void>();
  const api: FakeApi = {
    settings: appSettingsSchema.parse({ schemaVersion: APP_SETTINGS_SCHEMA_VERSION, ...overrides }),
    themes: [...builtInThemes],
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
  };
  return api;
}

export async function bootTestApp(overrides: Partial<AppSettings> = {}, scheme: ColorScheme = 'light') {
  resetSettingsStore();
  resetThemeStore();
  const api = createFakeApi(overrides, scheme);
  window.loopy = api;
  await bootstrap(api);
  return api;
}
