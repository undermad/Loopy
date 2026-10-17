import { themeSchema, type Theme } from '@shared/theme';
import { createJsonDirectoryStore, type JsonDirectoryStore } from './json-directory-store';

export type ThemesStore = JsonDirectoryStore<Theme>;

export function createThemesStore(directory: string): ThemesStore {
  return createJsonDirectoryStore({ directory, schema: themeSchema });
}
