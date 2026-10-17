import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import type { IpcMain } from 'electron';
import { EXCHANGE_FILE_EXTENSIONS, exchangeEnvelopeSchema, wrapExchange } from '@shared/exchange';
import { IpcChannel, layoutIdSchema, type ExportResult, type ImportLayoutResult } from '@shared/ipc';
import { LAYOUT_SCHEMA_VERSION, layoutPresetSchema, type LayoutPreset } from '@shared/layout';
import { isBuiltInLayoutId } from '@shared/layout-presets';
import type { LayoutsStore } from '../storage/layouts-store';
import type { FileDialogs } from './themes';

export interface LayoutsHandlerDeps {
  store: LayoutsStore;
  dialogs: FileDialogs;
  appVersion: string;
}

const layoutFilters = [{ name: 'Loopy layout', extensions: ['json'] }];

export async function exportLayout(deps: LayoutsHandlerDeps, raw: unknown): Promise<ExportResult> {
  const layout = layoutPresetSchema.parse(raw);
  const result = await deps.dialogs.showSaveDialog({
    defaultPath: `${layout.name}.${EXCHANGE_FILE_EXTENSIONS.layout}`,
    filters: layoutFilters,
  });
  if (result.canceled || !result.filePath) return { status: 'cancelled' };
  const envelope = wrapExchange('layout', LAYOUT_SCHEMA_VERSION, deps.appVersion, layout);
  await writeFile(result.filePath, JSON.stringify(envelope, null, 2), 'utf8');
  return { status: 'exported' };
}

export async function importLayout(deps: LayoutsHandlerDeps): Promise<ImportLayoutResult> {
  const result = await deps.dialogs.showOpenDialog({ properties: ['openFile'], filters: layoutFilters });
  const path = result.filePaths[0];
  if (result.canceled || !path) return { status: 'cancelled' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return { status: 'invalid' };
  }
  const envelope = exchangeEnvelopeSchema.safeParse(parsed);
  if (!envelope.success || envelope.data.loopy.kind !== 'layout') return { status: 'invalid' };
  const layout = layoutPresetSchema.safeParse(envelope.data.data);
  if (!layout.success) return { status: 'invalid' };
  const existing = await deps.store.list();
  const collides = isBuiltInLayoutId(layout.data.id) || existing.some((item) => item.id === layout.data.id);
  const saved = await deps.store.save({ ...layout.data, id: collides ? randomUUID() : layout.data.id });
  return { status: 'imported', layout: saved };
}

export function registerLayoutsHandlers(ipc: Pick<IpcMain, 'handle'>, deps: LayoutsHandlerDeps): void {
  ipc.handle(IpcChannel.layoutsList, () => deps.store.list());
  ipc.handle(IpcChannel.layoutsSave, (_event, raw: unknown) => {
    const layout: LayoutPreset = layoutPresetSchema.parse(raw);
    if (isBuiltInLayoutId(layout.id)) throw new Error(`Layout ${layout.id} is built in`);
    return deps.store.save(layout);
  });
  ipc.handle(IpcChannel.layoutsDelete, async (_event, rawId: unknown) => {
    const id = layoutIdSchema.parse(rawId);
    if (isBuiltInLayoutId(id)) throw new Error(`Layout ${id} is built in`);
    await deps.store.remove(id);
  });
  ipc.handle(IpcChannel.layoutsExport, (_event, raw: unknown) => exportLayout(deps, raw));
  ipc.handle(IpcChannel.layoutsImport, () => importLayout(deps));
}
