import { Archive, Box, File, FileText, Film, Image, Music, Type } from 'lucide-react';
import { type AssetFolder, type AssetKind } from '@shared/assets';
import { folderPath } from '@renderer/lib/assets';

export const KIND_ICONS: Record<AssetKind, typeof File> = {
  image: Image,
  audio: Music,
  video: Film,
  document: FileText,
  font: Type,
  model: Box,
  archive: Archive,
  other: File,
};

export const ROOT_VALUE = 'root';

export interface AssetDragData {
  type: 'asset';
  ids: string[];
}

export interface FolderDropData {
  type: 'folder';
  id: string | null;
}

export function folderDropId(id: string | null): string {
  return `drop:${id ?? ROOT_VALUE}`;
}

export function folderLabel(folders: AssetFolder[], id: string): string {
  return folderPath(folders, id)
    .map((folder) => folder.name)
    .join(' / ');
}

export function folderOptions(
  folders: AssetFolder[],
  topLevel: string,
  exclude: ReadonlySet<string> = new Set(),
) {
  return [
    { value: ROOT_VALUE, label: topLevel },
    ...folders
      .filter((folder) => !exclude.has(folder.id))
      .map((folder) => ({ value: folder.id, label: folderLabel(folders, folder.id) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];
}

export function folderValue(id: string | null): string {
  return id ?? ROOT_VALUE;
}

export function folderIdOf(value: string): string | null {
  return value === ROOT_VALUE ? null : value;
}

export function readString(state: Record<string, unknown>, key: string, fallback: string): string {
  const value = state[key];
  return typeof value === 'string' ? value : fallback;
}

export function readBoolean(state: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = state[key];
  return typeof value === 'boolean' ? value : fallback;
}

export function readFolderId(state: Record<string, unknown>, folders: AssetFolder[]): string | null {
  const value = state['folderId'];
  return typeof value === 'string' && folders.some((folder) => folder.id === value) ? value : null;
}

export function hasFiles(transfer: DataTransfer | null): boolean {
  return transfer !== null && Array.from(transfer.types).includes('Files');
}
