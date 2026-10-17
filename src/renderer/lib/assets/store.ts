import { createStore } from 'zustand/vanilla';
import {
  assetKindOf,
  resolveDropFolder,
  type AssetFileInput,
  type AssetPatch,
  type AssetSettingsPatch,
  type AssetsSnapshot,
  type AssetTarget,
  type FolderInput,
  type FolderPatch,
} from '@shared/assets';
import type { LoopyApi } from '@shared/ipc';
import { subscribeCurrentProject } from '@renderer/lib/project';

export type AssetsApi = Pick<
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

export interface AssetsState {
  snapshot: AssetsSnapshot | null;
  api: AssetsApi | null;
}

export const EMPTY_ASSETS: AssetsSnapshot = {
  folders: [],
  assets: [],
  settings: { dropTarget: 'byKind', kindFolders: {} },
};

export const assetsStore = createStore<AssetsState>(() => ({ snapshot: null, api: null }));

function requireApi(): AssetsApi {
  const { api } = assetsStore.getState();
  if (!api) throw new Error('Assets are not loaded');
  return api;
}

let loadToken = 0;

export async function loadAssets(): Promise<AssetsSnapshot> {
  loadToken += 1;
  const token = loadToken;
  const snapshot = await requireApi().getAssets();
  if (token === loadToken) assetsStore.setState({ snapshot });
  return snapshot;
}

export async function bootAssets(api: AssetsApi, hasProject: boolean): Promise<void> {
  assetsStore.setState({ api });
  if (hasProject) await loadAssets();
  subscribeCurrentProject((project) => {
    assetsStore.setState({ snapshot: null });
    if (project) void loadAssets();
  });
}

function apply(snapshot: AssetsSnapshot): AssetsSnapshot {
  loadToken += 1;
  assetsStore.setState({ snapshot });
  return snapshot;
}

export async function readFiles(files: Iterable<File>): Promise<AssetFileInput[]> {
  const inputs: AssetFileInput[] = [];
  for (const file of files) {
    inputs.push({ name: file.name, mime: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
  }
  return inputs;
}

export interface ImportOutcome {
  ids: string[];
  folderIds: (string | null)[];
}

export async function importFiles(files: Iterable<File>, target: AssetTarget): Promise<ImportOutcome> {
  const inputs = await readFiles(files);
  if (inputs.length === 0) return { ids: [], folderIds: [] };
  const result = await requireApi().importAssets({ target, files: inputs });
  if (result.status !== 'imported') return { ids: [], folderIds: [] };
  apply(result.snapshot);
  const folderIds = result.ids.map(
    (id) => result.snapshot.assets.find((asset) => asset.id === id)?.folderId ?? null,
  );
  return { ids: result.ids, folderIds };
}

export async function pickFiles(target: AssetTarget): Promise<string[]> {
  const result = await requireApi().pickAssets(target);
  if (result.status !== 'imported') return [];
  apply(result.snapshot);
  return result.ids;
}

export function dropFolderFor(fileName: string, mime?: string): string | null {
  const snapshot = assetsStore.getState().snapshot ?? EMPTY_ASSETS;
  return resolveDropFolder(
    snapshot.settings,
    assetKindOf(fileName, mime),
    new Set(snapshot.folders.map((folder) => folder.id)),
  );
}

export const folderActions = {
  create: async (input: FolderInput) => apply(await requireApi().createAssetFolder(input)),
  update: async (id: string, patch: FolderPatch) => apply(await requireApi().updateAssetFolder(id, patch)),
  remove: async (id: string) => apply(await requireApi().deleteAssetFolder(id)),
};

export const assetActions = {
  update: async (id: string, patch: AssetPatch) => apply(await requireApi().updateAsset(id, patch)),
  move: async (ids: string[], folderId: string | null) => apply(await requireApi().moveAssets(ids, folderId)),
  remove: async (ids: string[]) => apply(await requireApi().deleteAssets(ids)),
  exportToDisk: (id: string) => requireApi().exportAsset(id),
  setSettings: async (patch: AssetSettingsPatch) => apply(await requireApi().setAssetSettings(patch)),
};

export function resetAssetsStore(): void {
  assetsStore.setState({ snapshot: null, api: null });
}
