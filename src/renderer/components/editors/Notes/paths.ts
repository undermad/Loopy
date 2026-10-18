import type { AssetFolder } from '@shared/assets';
import { folderPath } from '@renderer/lib/assets';

export function folderPathOf(folders: AssetFolder[], folderId: string | null): string {
  if (folderId === null) return '';
  return folderPath(folders, folderId)
    .map((folder) => folder.name)
    .join('/');
}
