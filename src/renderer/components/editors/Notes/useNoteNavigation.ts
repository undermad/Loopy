import { useCallback } from 'react';
import type { LinkParts } from '@shared/markdown';
import { createNote, findNote, nextNoteTitle, resolveNote, useNoteIndex } from '@renderer/lib/notes';
import { selectTicket } from '@renderer/lib/tickets';
import { noteAlternates, openInEditor, openLinked, useWorkspaceNames } from '@renderer/lib/workspaces';
import { useLoopyItems } from './useLoopyItems';

export interface NoteNavigation {
  openNote: (noteId: string, anchor?: string | null) => void;
  openLink: (link: LinkParts, sourceId: string | null) => Promise<void>;
  openTag: (tag: string) => void;
}

export function useNoteNavigation(
  navigate?: (noteId: string, anchor: string | null) => void,
): NoteNavigation {
  const names = useWorkspaceNames();
  const index = useNoteIndex();
  const loopy = useLoopyItems();

  const openNote = useCallback(
    (noteId: string, anchor: string | null = null) => {
      if (navigate) {
        navigate(noteId, anchor);
        return;
      }
      openInEditor({
        editor: 'note',
        alternates: noteAlternates,
        state: { noteId, anchor },
        template: 'ideas',
        workspaceName: names.ideas,
      });
    },
    [names.ideas, navigate],
  );

  const openLink = useCallback(
    async (link: LinkParts, sourceId: string | null) => {
      if (link.kind === 'note') {
        if (link.target === '' && sourceId) {
          openNote(sourceId, link.subpath);
          return;
        }
        const existing = resolveNote(index, link.target);
        if (existing) {
          openNote(existing.id, link.subpath);
          return;
        }
        const source = findNote(sourceId);
        const created = await createNote({
          title: nextNoteTitle(link.target),
          folderId: source?.folderId ?? null,
        });
        openNote(created.id, null);
        return;
      }
      const item = loopy.find(link.kind, link.target);
      if (!item) return;
      if (link.kind === 'ticket') {
        openInEditor({ editor: 'ticket', state: {}, template: 'planning', workspaceName: names.planning });
        selectTicket(item.id);
        return;
      }
      openLinked({ kind: link.kind, id: item.id }, names);
    },
    [index, loopy, names, openNote],
  );

  const openTag = useCallback(
    (tag: string) => {
      openInEditor({
        editor: 'notes',
        state: { search: `tag:#${tag}` },
        template: 'ideas',
        workspaceName: names.ideas,
      });
    },
    [names.ideas],
  );

  return { openNote, openLink, openTag };
}
