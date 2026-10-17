import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import type { IpcMain, OpenDialogOptions, SaveDialogOptions } from 'electron';
import { EXCHANGE_FILE_EXTENSIONS, exchangeEnvelopeSchema, wrapExchange } from '@shared/exchange';
import { IpcChannel, themeIdSchema, type ExportResult, type ImportThemeResult } from '@shared/ipc';
import {
  THEME_SCHEMA_VERSION,
  builtInThemes,
  isBuiltInThemeId,
  themeSchema,
  type Theme,
} from '@shared/theme';
import type { ThemesStore } from '../storage/themes-store';

export interface FileDialogs {
  showSaveDialog: (options: SaveDialogOptions) => Promise<{ canceled: boolean; filePath?: string }>;
  showOpenDialog: (options: OpenDialogOptions) => Promise<{ canceled: boolean; filePaths: string[] }>;
}

export interface ThemesHandlerDeps {
  store: ThemesStore;
  dialogs: FileDialogs;
  appVersion: string;
}

const themeFilters = [{ name: 'Loopy theme', extensions: ['json'] }];

export async function listThemes(store: ThemesStore): Promise<Theme[]> {
  const custom = await store.list();
  return [...builtInThemes, ...custom.filter((theme) => !isBuiltInThemeId(theme.id))];
}

export async function saveTheme(store: ThemesStore, raw: unknown): Promise<Theme> {
  const theme = themeSchema.parse(raw);
  if (isBuiltInThemeId(theme.id)) throw new Error(`Theme ${theme.id} is built in`);
  return store.save(theme);
}

export async function exportTheme(deps: ThemesHandlerDeps, rawId: unknown): Promise<ExportResult> {
  const id = themeIdSchema.parse(rawId);
  const theme = (await listThemes(deps.store)).find((candidate) => candidate.id === id);
  if (!theme) throw new Error(`Unknown theme ${id}`);
  const result = await deps.dialogs.showSaveDialog({
    defaultPath: `${theme.name}.${EXCHANGE_FILE_EXTENSIONS.theme}`,
    filters: themeFilters,
  });
  if (result.canceled || !result.filePath) return { status: 'cancelled' };
  const envelope = wrapExchange('theme', THEME_SCHEMA_VERSION, deps.appVersion, theme);
  await writeFile(result.filePath, JSON.stringify(envelope, null, 2), 'utf8');
  return { status: 'exported' };
}

export async function importTheme(deps: ThemesHandlerDeps): Promise<ImportThemeResult> {
  const result = await deps.dialogs.showOpenDialog({ properties: ['openFile'], filters: themeFilters });
  const path = result.filePaths[0];
  if (result.canceled || !path) return { status: 'cancelled' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return { status: 'invalid' };
  }
  const envelope = exchangeEnvelopeSchema.safeParse(parsed);
  if (!envelope.success || envelope.data.loopy.kind !== 'theme') return { status: 'invalid' };
  const theme = themeSchema.safeParse(envelope.data.data);
  if (!theme.success) return { status: 'invalid' };
  const existing = await listThemes(deps.store);
  const id = existing.some((candidate) => candidate.id === theme.data.id) ? randomUUID() : theme.data.id;
  const saved = await deps.store.save({ ...theme.data, id });
  return { status: 'imported', theme: saved };
}

export function registerThemesHandlers(ipc: Pick<IpcMain, 'handle'>, deps: ThemesHandlerDeps): void {
  ipc.handle(IpcChannel.themesList, () => listThemes(deps.store));
  ipc.handle(IpcChannel.themesSave, (_event, raw: unknown) => saveTheme(deps.store, raw));
  ipc.handle(IpcChannel.themesDelete, async (_event, rawId: unknown) => {
    const id = themeIdSchema.parse(rawId);
    if (isBuiltInThemeId(id)) throw new Error(`Theme ${id} is built in`);
    await deps.store.remove(id);
  });
  ipc.handle(IpcChannel.themesExport, (_event, rawId: unknown) => exportTheme(deps, rawId));
  ipc.handle(IpcChannel.themesImport, () => importTheme(deps));
}
