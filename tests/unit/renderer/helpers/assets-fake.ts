import { vi } from 'vitest';
import {
  DEFAULT_FOLDER_IDS,
  assetImportSchema,
  assetKindOf,
  assetMimeOf,
  assetPatchSchema,
  assetSettingsPatchSchema,
  assetSettingsSchema,
  folderInputSchema,
  folderPatchSchema,
  resolveDropFolder,
  type Asset,
  type AssetFileInput,
  type AssetFolder,
  type AssetTarget,
} from '@shared/assets';
import type { LoopyApi } from '@shared/ipc';

export type AssetsFakeApi = Pick<
  LoopyApi,
  | 'getAssets'
  | 'createAssetFolder'
  | 'updateAssetFolder'
  | 'deleteAssetFolder'
  | 'importAssets'
  | 'pickAssets'
  | 'updateAsset'
  | 'moveAssets'
  | 'deleteAssets'
  | 'exportAsset'
  | 'setAssetSettings'
>;

const STAMP = '2026-10-17T09:00:00.000Z';

function defaultFolders(): AssetFolder[] {
  const names: Record<string, string> = {
    'folder-images': 'Images',
    'folder-audio': 'Audio',
    'folder-video': 'Video',
    'folder-documents': 'Documents',
    'folder-fonts': 'Fonts',
    'folder-models': 'Models',
    'folder-archives': 'Archives',
  };
  return Object.values(DEFAULT_FOLDER_IDS).map((id) => ({
    id,
    parentId: null,
    name: names[id] ?? id,
    createdAt: STAMP,
    updatedAt: STAMP,
  }));
}

export function createAssetsFake() {
  const data = {
    snapshot: {
      folders: defaultFolders(),
      assets: [] as Asset[],
      settings: assetSettingsSchema.parse({}),
    },
    counter: 0,
    pickQueue: [] as AssetFileInput[][],
  };
  const nextId = (prefix: string) => {
    data.counter += 1;
    return `${prefix}-${String(data.counter)}`;
  };
  const snapshot = () => Promise.resolve(structuredClone(data.snapshot));
  const folderIds = () => new Set(data.snapshot.folders.map((folder) => folder.id));
  const add = (files: AssetFileInput[], target: AssetTarget) => {
    const ids: string[] = [];
    for (const file of files) {
      const kind = assetKindOf(file.name, file.mime);
      const folderId =
        target === 'auto' ? resolveDropFolder(data.snapshot.settings, kind, folderIds()) : target;
      const id = nextId('asset');
      data.snapshot.assets.push({
        id,
        folderId,
        name: file.name,
        kind,
        mime: assetMimeOf(file.name, file.mime),
        size: file.bytes.byteLength,
        sha256: 'a'.repeat(64),
        width: kind === 'image' ? 16 : null,
        height: kind === 'image' ? 16 : null,
        tags: [],
        createdAt: STAMP,
        updatedAt: STAMP,
      });
      ids.push(id);
    }
    return ids;
  };
  const api: AssetsFakeApi = {
    getAssets: vi.fn(snapshot),
    createAssetFolder: vi.fn((raw: unknown) => {
      const input = folderInputSchema.parse(raw);
      data.snapshot.folders.push({
        id: nextId('folder'),
        parentId: input.parentId,
        name: input.name,
        createdAt: STAMP,
        updatedAt: STAMP,
      });
      return snapshot();
    }),
    updateAssetFolder: vi.fn((id: string, raw: unknown) => {
      const patch = folderPatchSchema.parse(raw);
      data.snapshot.folders = data.snapshot.folders.map((folder) =>
        folder.id === id
          ? {
              ...folder,
              name: patch.name ?? folder.name,
              parentId: patch.parentId === undefined ? folder.parentId : patch.parentId,
            }
          : folder,
      );
      return snapshot();
    }),
    deleteAssetFolder: vi.fn((id: string) => {
      const parent = data.snapshot.folders.find((folder) => folder.id === id)?.parentId ?? null;
      data.snapshot.folders = data.snapshot.folders
        .filter((folder) => folder.id !== id)
        .map((folder) => (folder.parentId === id ? { ...folder, parentId: parent } : folder));
      data.snapshot.assets = data.snapshot.assets.map((asset) =>
        asset.folderId === id ? { ...asset, folderId: parent } : asset,
      );
      return snapshot();
    }),
    importAssets: vi.fn(async (raw: unknown) => {
      const input = assetImportSchema.parse(raw);
      const ids = add(input.files, input.target);
      return { status: 'imported' as const, snapshot: await snapshot(), ids };
    }),
    pickAssets: vi.fn(async (target: AssetTarget) => {
      const files = data.pickQueue.shift();
      if (!files) return { status: 'cancelled' as const };
      const ids = add(files, target);
      return { status: 'imported' as const, snapshot: await snapshot(), ids };
    }),
    updateAsset: vi.fn((id: string, raw: unknown) => {
      const patch = assetPatchSchema.parse(raw);
      data.snapshot.assets = data.snapshot.assets.map((asset) =>
        asset.id === id
          ? {
              ...asset,
              name: patch.name ?? asset.name,
              folderId: patch.folderId === undefined ? asset.folderId : patch.folderId,
              tags: patch.tags ?? asset.tags,
            }
          : asset,
      );
      return snapshot();
    }),
    moveAssets: vi.fn((ids: string[], folderId: string | null) => {
      data.snapshot.assets = data.snapshot.assets.map((asset) =>
        ids.includes(asset.id) ? { ...asset, folderId } : asset,
      );
      return snapshot();
    }),
    deleteAssets: vi.fn((ids: string[]) => {
      data.snapshot.assets = data.snapshot.assets.filter((asset) => !ids.includes(asset.id));
      return snapshot();
    }),
    exportAsset: vi.fn(() => Promise.resolve({ status: 'exported' as const })),
    setAssetSettings: vi.fn((raw: unknown) => {
      const patch = assetSettingsPatchSchema.parse(raw);
      data.snapshot.settings = assetSettingsSchema.parse({
        ...data.snapshot.settings,
        ...patch,
        kindFolders: { ...data.snapshot.settings.kindFolders, ...(patch.kindFolders ?? {}) },
      });
      return snapshot();
    }),
  };
  return { api, data };
}
