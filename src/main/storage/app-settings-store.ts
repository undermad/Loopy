import { APP_SETTINGS_SCHEMA_VERSION, appSettingsSchema, type AppSettings } from '@shared/app-settings';
import { createJsonStore, type JsonStore } from './json-store';
import type { MigrationMap } from './migrations';

const appSettingsMigrations: MigrationMap = {
  1: (data) => {
    const { theme, ...rest } = data;
    const mode = theme === 'light' || theme === 'dark' ? theme : 'system';
    return { ...rest, theme: { mode, light: 'light', dark: 'dark' } };
  },
  2: (data) => data,
};

export function createAppSettingsStore(path: string): JsonStore<AppSettings> {
  return createJsonStore({
    path,
    schema: appSettingsSchema,
    version: APP_SETTINGS_SCHEMA_VERSION,
    migrations: appSettingsMigrations,
  });
}
