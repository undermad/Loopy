import { ASSET_KINDS, type Asset, type AssetFolder, type AssetKind } from '@shared/assets';

export interface FolderNode {
  folder: AssetFolder;
  children: FolderNode[];
  depth: number;
}

export function buildFolderTree(folders: AssetFolder[]): FolderNode[] {
  const byParent = new Map<string | null, AssetFolder[]>();
  const ids = new Set(folders.map((folder) => folder.id));
  for (const folder of folders) {
    const parent = folder.parentId !== null && ids.has(folder.parentId) ? folder.parentId : null;
    const list = byParent.get(parent) ?? [];
    list.push(folder);
    byParent.set(parent, list);
  }
  const visited = new Set<string>();
  const build = (parent: string | null, depth: number): FolderNode[] =>
    (byParent.get(parent) ?? [])
      .filter((folder) => !visited.has(folder.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((folder) => {
        visited.add(folder.id);
        return { folder, depth, children: build(folder.id, depth + 1) };
      });
  return build(null, 0);
}

export function folderPath(folders: AssetFolder[], id: string | null): AssetFolder[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const path: AssetFolder[] = [];
  let current = id;
  const seen = new Set<string>();
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    const folder = byId.get(current);
    if (!folder) break;
    path.unshift(folder);
    current = folder.parentId;
  }
  return path;
}

export function descendantFolderIds(folders: AssetFolder[], id: string): Set<string> {
  const result = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of folders) {
      if (folder.parentId !== null && result.has(folder.parentId) && !result.has(folder.id)) {
        result.add(folder.id);
        changed = true;
      }
    }
  }
  return result;
}

export function matchesAssetSearch(asset: Asset, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    asset.name.toLowerCase().includes(needle) ||
    asset.kind.includes(needle) ||
    asset.tags.some((tag) => tag.toLowerCase().includes(needle))
  );
}

export function assetsInFolder(assets: Asset[], folderId: string | null, query = ''): Asset[] {
  return assets.filter((asset) => asset.folderId === folderId && matchesAssetSearch(asset, query));
}

export function assetsOfKind(assets: Asset[], kind: AssetKind, query = ''): Asset[] {
  return assets.filter((asset) => asset.kind === kind && matchesAssetSearch(asset, query));
}

export function kindCounts(assets: Asset[]): Record<AssetKind, number> {
  const counts = Object.fromEntries(ASSET_KINDS.map((kind) => [kind, 0])) as Record<AssetKind, number>;
  for (const asset of assets) counts[asset.kind] += 1;
  return counts;
}

export function folderCounts(folders: AssetFolder[], assets: Asset[]): Map<string | null, number> {
  const direct = new Map<string | null, number>();
  for (const asset of assets) direct.set(asset.folderId, (direct.get(asset.folderId) ?? 0) + 1);
  const totals = new Map<string | null, number>();
  for (const folder of folders) {
    let total = 0;
    for (const id of descendantFolderIds(folders, folder.id)) total += direct.get(id) ?? 0;
    totals.set(folder.id, total);
  }
  totals.set(null, direct.get(null) ?? 0);
  return totals;
}
