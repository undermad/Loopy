import { useMemo } from 'react';
import { useStore } from 'zustand';
import type { Note } from '@shared/notes';
import { buildIndex, type NoteIndex } from './links';
import { notesStore } from './store';

const EMPTY: Note[] = [];

export function useNotes(): Note[] {
  return useStore(notesStore, (state) => state.notes ?? EMPTY);
}

export function useNotesLoaded(): boolean {
  return useStore(notesStore, (state) => state.notes !== null);
}

export function useNote(id: string | null): Note | null {
  return useStore(notesStore, (state) => state.notes?.find((note) => note.id === id) ?? null);
}

export function useActiveNoteId(): string | null {
  return useStore(notesStore, (state) => state.activeId);
}

export function useNoteIndex(): NoteIndex {
  const notes = useNotes();
  return useMemo(() => buildIndex(notes), [notes]);
}
