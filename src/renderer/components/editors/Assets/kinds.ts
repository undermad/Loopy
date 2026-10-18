import { Archive, Box, File, FileText, Film, Image, Music, Type } from 'lucide-react';
import { type AssetFolder, type AssetKind, type AssetScope } from '@shared/assets';
import type { BoardLink } from '@shared/board';
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
  links: BoardLink[];
}

export interface FolderDropData {
  type: 'folder';
  id: string | null;
  scope: AssetScope;
}

export type InternalKind = 'board' | 'palette' | 'note';

export interface InternalItem {
  kind: InternalKind;
  id: string;
  name: string;
  folderId: string | null;
  colours: string[];
}

export const INTERNAL_SCOPES: Record<InternalKind, Exclude<AssetScope, 'files'>> = {
  board: 'boards',
  palette: 'palettes',
  note: 'notes',
};

export function internalKey(item: Pick<InternalItem, 'kind' | 'id'>): string {
  return `${item.kind}:${item.id}`;
}

export function folderDropId(id: string | null, scope: AssetScope = 'files'): string {
  return `drop:${scope}:${id ?? ROOT_VALUE}`;
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

export function readFolderId(
  state: Record<string, unknown>,
  folders: AssetFolder[],
  scope: AssetScope = 'files',
): string | null {
  const value = state['folderId'];
  return typeof value === 'string' && folders.some((folder) => folder.id === value && folder.scope === scope)
    ? value
    : null;
}

export function readScope(state: Record<string, unknown>): AssetScope {
  const value = state['scope'];
  return value === 'boards' || value === 'palettes' || value === 'notes' ? value : 'files';
}

export function hasFiles(transfer: DataTransfer | null): boolean {
  return transfer !== null && Array.from(transfer.types).includes('Files');
}
