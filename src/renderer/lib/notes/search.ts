import type { PropertyValue } from '@shared/markdown';
import type { Note } from '@shared/notes';
import { tagMatches, type NoteIndex } from './links';

export type QueryField = 'text' | 'tag' | 'path' | 'title' | 'task' | 'todo' | 'done' | 'property';

export interface QueryTerm {
  field: QueryField;
  value: string;
  key?: string;
  negate: boolean;
}

export interface SearchHit {
  note: Note;
  lines: string[];
}

const FIELDS: Record<string, QueryField> = {
  tag: 'tag',
  path: 'path',
  folder: 'path',
  file: 'title',
  title: 'title',
  task: 'task',
  'task-todo': 'todo',
  'task-done': 'done',
};

export function parseQuery(query: string): QueryTerm[] {
  const terms: QueryTerm[] = [];
  const pattern = /(-?)(?:\[([^\]:]+)(?::([^\]]*))?\]|([\w-]+):(?:"([^"]*)"|(\S+))|"([^"]*)"|(\S+))/g;
  for (const match of query.matchAll(pattern)) {
    const negate = match[1] === '-';
    if (match[2] !== undefined) {
      terms.push({ field: 'property', key: match[2].trim(), value: (match[3] ?? '').trim(), negate });
      continue;
    }
    if (match[4] !== undefined) {
      const field = FIELDS[match[4].toLowerCase()];
      const value = match[5] ?? match[6] ?? '';
      if (field) terms.push({ field, value, negate });
      else terms.push({ field: 'text', value: `${match[4]}:${value}`, negate });
      continue;
    }
    const text = match[7] ?? match[8] ?? '';
    if (text.length === 0) continue;
    if (match[8]?.startsWith('#') && text.length > 1)
      terms.push({ field: 'tag', value: text.slice(1), negate });
    else terms.push({ field: 'text', value: text, negate });
  }
  return terms;
}

function propertyText(value: PropertyValue | undefined): string {
  if (value === undefined || value === null) return '';
  return Array.isArray(value) ? value.join(' ') : String(value);
}

function matchTerm(index: NoteIndex, note: Note, term: QueryTerm, path: string): string[] | null {
  const value = term.value.toLowerCase();
  const parsed = index.parsed.get(note.id);
  switch (term.field) {
    case 'tag':
      return parsed?.tags.some((tag) => tagMatches(tag, value)) ? [] : null;
    case 'path':
      return path.toLowerCase().includes(value) ? [] : null;
    case 'title':
      return note.title.toLowerCase().includes(value) ? [] : null;
    case 'task':
    case 'todo':
    case 'done': {
      const tasks = (parsed?.tasks ?? []).filter(
        (task) =>
          (term.field === 'task' || (term.field === 'done') === task.done) &&
          task.text.toLowerCase().includes(value),
      );
      return tasks.length > 0 ? tasks.map((task) => task.text) : null;
    }
    case 'property': {
      const key = (term.key ?? '').toLowerCase();
      const entry = Object.entries(parsed?.properties ?? {}).find(([name]) => name.toLowerCase() === key);
      if (!entry) return null;
      return value === '' || propertyText(entry[1]).toLowerCase().includes(value) ? [] : null;
    }
    case 'text': {
      const titleHit = note.title.toLowerCase().includes(value);
      const lines = note.body.split('\n').filter((line) => line.toLowerCase().includes(value));
      return titleHit || lines.length > 0 ? lines.map((line) => line.trim()).slice(0, 5) : null;
    }
  }
}

export function searchNotes(
  index: NoteIndex,
  query: string,
  pathOf: (note: Note) => string = () => '',
): SearchHit[] {
  const terms = parseQuery(query);
  if (terms.length === 0) return [];
  const hits: SearchHit[] = [];
  for (const note of index.notes) {
    const path = pathOf(note);
    const lines: string[] = [];
    let ok = true;
    for (const term of terms) {
      const result = matchTerm(index, note, term, path);
      if ((result === null) !== term.negate) {
        ok = false;
        break;
      }
      if (result && !term.negate) lines.push(...result);
    }
    if (ok) hits.push({ note, lines: [...new Set(lines)].slice(0, 5) });
  }
  return hits;
}

export function fuzzyScore(text: string, query: string): number {
  const haystack = text.toLowerCase();
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return 1;
  const direct = haystack.indexOf(needle);
  if (direct >= 0) return 1000 - direct - (haystack.length - needle.length) / 100;
  let position = 0;
  let score = 0;
  for (const char of needle) {
    const found = haystack.indexOf(char, position);
    if (found < 0) return 0;
    score += found === position ? 3 : 1;
    position = found + 1;
  }
  return score;
}
