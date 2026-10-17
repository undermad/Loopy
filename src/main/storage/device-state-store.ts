import { DEVICE_STATE_SCHEMA_VERSION, deviceStateSchema, type DeviceState } from '@shared/device-state';
import { createJsonStore, type JsonStore } from './json-store';
import type { MigrationMap } from './migrations';

const deviceStateMigrations: MigrationMap = {};

export function createDeviceStateStore(path: string): JsonStore<DeviceState> {
  return createJsonStore({
    path,
    schema: deviceStateSchema,
    version: DEVICE_STATE_SCHEMA_VERSION,
    migrations: deviceStateMigrations,
  });
}
