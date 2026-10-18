import { NotebookText, Palette, PenTool } from 'lucide-react';
import { sanitiseNoteTitle } from '@shared/notes';
import { deleteBoard, updateBoard } from '@renderer/lib/board';
import { deleteNotes, updateNote } from '@renderer/lib/notes';
import { deletePalette, updatePalette } from '@renderer/lib/palettes';
import type { InternalKind } from './kinds';

export const INTERNAL_KINDS: readonly InternalKind[] = ['board', 'palette', 'note'];

export const INTERNAL_ICONS: Record<InternalKind, typeof PenTool> = {
  board: PenTool,
  palette: Palette,
  note: NotebookText,
};

export function isInternalKind(value: string): value is InternalKind {
  return (INTERNAL_KINDS as readonly string[]).includes(value);
}

export function saveInternal(
  kind: InternalKind,
  id: string,
  patch: { name?: string; folderId?: string | null },
): Promise<unknown> {
  if (kind === 'board') return updateBoard(id, patch);
  if (kind === 'palette') return updatePalette(id, patch);
  return updateNote(id, {
    ...(patch.name === undefined ? {} : { title: sanitiseNoteTitle(patch.name) }),
    ...(patch.folderId === undefined ? {} : { folderId: patch.folderId }),
  });
}

export function deleteInternal(kind: InternalKind, id: string): Promise<unknown> {
  if (kind === 'board') return deleteBoard(id);
  if (kind === 'palette') return deletePalette(id);
  return deleteNotes([id]);
}
