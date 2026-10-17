import { APP_SETTINGS_SCHEMA_VERSION, appSettingsSchema, type AppSettings } from '@shared/app-settings';
import { createJsonStore, type JsonStore } from './json-store';
import type { MigrationMap } from './migrations';

const appSettingsMigrations: MigrationMap = {};

export function createAppSettingsStore(path: string): JsonStore<AppSettings> {
  return createJsonStore({
    path,
    schema: appSettingsSchema,
    version: APP_SETTINGS_SCHEMA_VERSION,
    migrations: appSettingsMigrations,
  });
}
