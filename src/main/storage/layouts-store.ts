import { layoutPresetSchema, type LayoutPreset } from '@shared/layout';
import { createJsonDirectoryStore, type JsonDirectoryStore } from './json-directory-store';

export type LayoutsStore = JsonDirectoryStore<LayoutPreset>;

export function createLayoutsStore(directory: string): LayoutsStore {
  return createJsonDirectoryStore({ directory, schema: layoutPresetSchema });
}
