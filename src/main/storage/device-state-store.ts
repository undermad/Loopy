import { dirname, join } from 'node:path';
import { DEVICE_STATE_SCHEMA_VERSION, deviceStateSchema, type DeviceState } from '@shared/device-state';
import { PROJECT_FILE_EXTENSION } from '@shared/project';
import { createJsonStore, type JsonStore } from './json-store';
import type { MigrationMap } from './migrations';
import { storagePaths } from './paths';

function deviceStateMigrations(projects: string): MigrationMap {
  return {
    1: ({ lastProjectId: _lastProjectId, recentProjects, ...rest }) => ({
      ...rest,
      recentProjects: Array.isArray(recentProjects)
        ? recentProjects.map((entry: Record<string, unknown>) => ({
            ...entry,
            path: join(projects, `${String(entry['id'])}.${PROJECT_FILE_EXTENSION}`),
          }))
        : [],
    }),
  };
}

export function createDeviceStateStore(path: string): JsonStore<DeviceState> {
  return createJsonStore({
    path,
    schema: deviceStateSchema,
    version: DEVICE_STATE_SCHEMA_VERSION,
    migrations: deviceStateMigrations(storagePaths(dirname(path)).projects),
  });
}
