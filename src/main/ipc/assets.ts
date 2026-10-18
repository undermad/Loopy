import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { IpcMain } from 'electron';
import { assetTargetSchema, type AssetPickResult } from '@shared/assets';
import { IpcChannel, entityIdSchema, type ExportResult } from '@shared/ipc';
import {
  createFolder,
  deleteAssets,
  deleteFolder,
  importAssets,
  moveAssets,
  readAssetBytes,
  readAssetName,
  readAssetsSnapshot,
  updateAsset,
  updateAssetSettings,
  updateFolder,
} from '../storage/assets-repository';
import { trackRename } from '../storage/notes-repository';
import type { FileDialogs } from './themes';
import type { TicketsHandlerDeps } from './tickets';
import { NoProjectError } from './tickets';

export interface AssetsHandlerDeps extends TicketsHandlerDeps {
  dialogs: FileDialogs;
}

export function registerAssetsHandlers(ipc: Pick<IpcMain, 'handle'>, deps: AssetsHandlerDeps): void {
  const db = () => {
    const project = deps.project();
    if (!project) throw new NoProjectError();
    return project.db;
  };
  const id = (raw: unknown) => entityIdSchema.parse(raw);

  async function pick(rawTarget: unknown): Promise<AssetPickResult> {
    const target = assetTargetSchema.parse(rawTarget);
    const database = db();
    const picked = await deps.dialogs.showOpenDialog({ properties: ['openFile', 'multiSelections'] });
    if (picked.canceled || picked.filePaths.length === 0) return { status: 'cancelled' };
    const files = await Promise.all(
      picked.filePaths.map(async (path) => ({ name: basename(path), bytes: await readFile(path) })),
    );
    const imported = importAssets(database, { target, files });
    return { status: 'imported', snapshot: imported.snapshot, ids: imported.ids };
  }

  async function exportAsset(rawId: unknown): Promise<ExportResult> {
    const assetId = id(rawId);
    const database = db();
    const name = readAssetName(database, assetId);
    if (name === null) throw new Error(`Unknown asset ${assetId}`);
    const picked = await deps.dialogs.showSaveDialog({ defaultPath: name });
    if (picked.canceled || !picked.filePath) return { status: 'cancelled' };
    const content = readAssetBytes(database, assetId);
    if (!content) throw new Error(`Unknown asset ${assetId}`);
    await writeFile(picked.filePath, content.bytes);
    return { status: 'exported' };
  }

  ipc.handle(IpcChannel.assetsSnapshot, () => readAssetsSnapshot(db()));
  ipc.handle(IpcChannel.assetsCreateFolder, (_event, input: unknown) => createFolder(db(), input));
  ipc.handle(IpcChannel.assetsUpdateFolder, (_event, rawId: unknown, patch: unknown) =>
    updateFolder(db(), id(rawId), patch),
  );
  ipc.handle(IpcChannel.assetsDeleteFolder, (_event, rawId: unknown) => deleteFolder(db(), id(rawId)));
  ipc.handle(IpcChannel.assetsImport, (_event, input: unknown): AssetPickResult => {
    const imported = importAssets(db(), input);
    return { status: 'imported', snapshot: imported.snapshot, ids: imported.ids };
  });
  ipc.handle(IpcChannel.assetsPick, (_event, target: unknown) => pick(target));
  ipc.handle(IpcChannel.assetsUpdate, (_event, rawId: unknown, patch: unknown) => {
    const database = db();
    const assetId = id(rawId);
    return trackRename(database, 'asset', assetId, () => updateAsset(database, assetId, patch));
  });
  ipc.handle(IpcChannel.assetsMove, (_event, ids: unknown, folderId: unknown) =>
    moveAssets(db(), ids, entityIdSchema.nullable().parse(folderId)),
  );
  ipc.handle(IpcChannel.assetsDelete, (_event, ids: unknown) => deleteAssets(db(), ids));
  ipc.handle(IpcChannel.assetsExport, (_event, rawId: unknown) => exportAsset(rawId));
  ipc.handle(IpcChannel.assetsSettings, (_event, patch: unknown) => updateAssetSettings(db(), patch));
}
