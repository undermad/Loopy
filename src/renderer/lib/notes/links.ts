import { findMentions, lineAround, parseNote, type NoteLink, type ParsedNote } from '@shared/markdown';
import type { Note } from '@shared/notes';

export interface LinkRef {
  sourceId: string;
  targetId: string | null;
  link: NoteLink;
  context: string;
}

export interface TagEntry {
  name: string;
  noteIds: string[];
}

export interface NoteIndex {
  notes: Note[];
  byId: Map<string, Note>;
  parsed: Map<string, ParsedNote>;
  byName: Map<string, Note>;
  outgoing: Map<string, LinkRef[]>;
  backlinks: Map<string, LinkRef[]>;
  unresolved: Map<string, { name: string; sources: string[] }>;
  tags: Map<string, TagEntry>;
}

const cache = new Map<string, { body: string; parsed: ParsedNote }>();

export function parsedNote(note: Pick<Note, 'id' | 'body'>): ParsedNote {
  const cached = cache.get(note.id);
  if (cached?.body === note.body) return cached.parsed;
  const parsed = parseNote(note.body);
  cache.set(note.id, { body: note.body, parsed });
  return parsed;
}

export function buildIndex(notes: Note[]): NoteIndex {
  const byId = new Map(notes.map((note) => [note.id, note]));
  const parsed = new Map(notes.map((note) => [note.id, parsedNote(note)]));
  const byName = new Map<string, Note>();
  for (const note of notes) byName.set(note.title.toLowerCase(), note);
  for (const note of notes) {
    for (const alias of parsed.get(note.id)?.aliases ?? []) {
      const key = alias.toLowerCase();
      if (!byName.has(key)) byName.set(key, note);
    }
  }
  const outgoing = new Map<string, LinkRef[]>();
  const backlinks = new Map<string, LinkRef[]>();
  const unresolved = new Map<string, { name: string; sources: string[] }>();
  const tags = new Map<string, TagEntry>();
  for (const note of notes) {
    const info = parsed.get(note.id);
    if (!info) continue;
    const refs: LinkRef[] = [];
    for (const link of info.links) {
      if (link.kind !== 'note') {
        refs.push({ sourceId: note.id, targetId: null, link, context: lineAround(note.body, link.from) });
        continue;
      }
      const target = link.target === '' ? note : byName.get(link.target.toLowerCase());
      const ref = {
        sourceId: note.id,
        targetId: target?.id ?? null,
        link,
        context: lineAround(note.body, link.from),
      };
      refs.push(ref);
      if (target) {
        if (target.id !== note.id) backlinks.set(target.id, [...(backlinks.get(target.id) ?? []), ref]);
      } else {
        const key = link.target.toLowerCase();
        const entry = unresolved.get(key) ?? { name: link.target, sources: [] };
        if (!entry.sources.includes(note.id)) entry.sources.push(note.id);
        unresolved.set(key, entry);
      }
    }
    outgoing.set(note.id, refs);
    for (const tag of info.tags) {
      const key = tag.toLowerCase();
      const entry = tags.get(key) ?? { name: tag, noteIds: [] };
      if (!entry.noteIds.includes(note.id)) entry.noteIds.push(note.id);
      tags.set(key, entry);
    }
  }
  return { notes, byId, parsed, byName, outgoing, backlinks, unresolved, tags };
}

export function resolveNote(index: NoteIndex, target: string): Note | null {
  return index.byName.get(target.trim().replace(/\.md$/i, '').toLowerCase()) ?? null;
}

export interface UnlinkedMention {
  sourceId: string;
  from: number;
  to: number;
  context: string;
}

export function unlinkedMentions(index: NoteIndex, noteId: string): UnlinkedMention[] {
  const note = index.byId.get(noteId);
  if (!note) return [];
  const names = [note.title, ...(index.parsed.get(noteId)?.aliases ?? [])];
  const out: UnlinkedMention[] = [];
  for (const other of index.notes) {
    if (other.id === noteId) continue;
    for (const mention of findMentions(other.body, names)) {
      out.push({ sourceId: other.id, from: mention.from, to: mention.to, context: mention.line });
    }
  }
  return out;
}

export function tagMatches(tag: string, wanted: string): boolean {
  const a = tag.toLowerCase();
  const b = wanted.replace(/^#/, '').toLowerCase();
  return a === b || a.startsWith(`${b}/`);
}
