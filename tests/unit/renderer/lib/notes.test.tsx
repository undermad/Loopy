import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssetFolder } from '@shared/assets';
import type { Note } from '@shared/notes';
import {
  applyTemplate,
  bootNotes,
  buildGraph,
  buildIndex,
  createNote,
  editNoteBody,
  flushNotes,
  fuzzyScore,
  isTemplateFolder,
  parseQuery,
  resetNotesStore,
  resolveNote,
  searchNotes,
  templateValues,
  unlinkedMentions,
  updateNote,
} from '@renderer/lib/notes';
import { createNotesFake } from '../helpers/notes-fake';

const STAMP = '2026-10-17T09:00:00.000Z';

function note(id: string, title: string, body: string, folderId: string | null = null): Note {
  return { id, title, body, folderId, starred: false, createdAt: STAMP, updatedAt: STAMP };
}

function folder(id: string, name: string, parentId: string | null = null): AssetFolder {
  return { id, name, parentId, scope: 'notes', createdAt: STAMP, updatedAt: STAMP };
}

const notes = [
  note(
    'a',
    'Combat',
    '---\naliases: [Fighting]\ntags: [system]\n---\nUses [[Stamina]] and [[Missing]]. #core',
  ),
  note(
    'b',
    'Stamina',
    'Drains during combat. See [[Fighting#Melee|melee]].\n- [ ] Tune drain\n- [x] Prototype',
  ),
  note('c', 'Lore', 'A world of [[board:World map]] with #story/world', 'world'),
  note('d', 'Orphan', 'Nothing here'),
];

afterEach(() => {
  resetNotesStore();
  vi.useRealTimers();
});

describe('note index', () => {
  it('resolves titles and aliases, backlinks, unresolved links and tags', () => {
    const index = buildIndex(notes);
    expect(resolveNote(index, 'fighting')?.id).toBe('a');
    expect(resolveNote(index, 'stamina.md')?.id).toBe('b');
    expect(index.backlinks.get('a')?.map((ref) => ref.sourceId)).toEqual(['b']);
    expect(index.backlinks.get('b')?.[0]?.context).toContain('Uses [[Stamina]]');
    expect([...index.unresolved.values()]).toEqual([{ name: 'Missing', sources: ['a'] }]);
    expect([...index.tags.keys()].sort()).toEqual(['core', 'story/world', 'system']);
    expect(index.outgoing.get('c')?.[0]?.link.kind).toBe('board');
  });

  it('finds unlinked mentions of a note by title and alias', () => {
    const mentions = unlinkedMentions(buildIndex(notes), 'a');
    expect(mentions.map((mention) => mention.sourceId)).toEqual(['b']);
    expect(mentions[0]?.context).toContain('Drains during combat');
  });
});

describe('note search', () => {
  it('parses fields, phrases, properties and negation', () => {
    expect(parseQuery('tag:#core "big boss" -draft [status:idea] path:World #lore task-todo:tune')).toEqual([
      { field: 'tag', value: '#core', negate: false },
      { field: 'text', value: 'big boss', negate: false },
      { field: 'text', value: 'draft', negate: true },
      { field: 'property', key: 'status', value: 'idea', negate: false },
      { field: 'path', value: 'World', negate: false },
      { field: 'tag', value: 'lore', negate: false },
      { field: 'todo', value: 'tune', negate: false },
    ]);
  });

  it('matches notes by text, tags with nesting, paths, tasks and properties', () => {
    const index = buildIndex(notes);
    const titles = (query: string) =>
      searchNotes(index, query, (item) => (item.folderId === 'world' ? 'World' : '')).map(
        (hit) => hit.note.title,
      );
    expect(titles('combat')).toEqual(['Combat', 'Stamina']);
    expect(titles('tag:#story')).toEqual(['Lore']);
    expect(titles('path:world')).toEqual(['Lore']);
    expect(titles('task-todo:tune')).toEqual(['Stamina']);
    expect(titles('task-done:tune')).toEqual([]);
    expect(titles('[aliases:fight]')).toEqual(['Combat']);
    expect(titles('-tag:#core combat')).toEqual(['Stamina']);
    expect(searchNotes(index, 'drains', () => '')[0]?.lines).toEqual([
      'Drains during combat. See [[Fighting#Melee|melee]].',
    ]);
    expect(titles('')).toEqual([]);
  });

  it('scores fuzzy matches with direct hits first', () => {
    expect(fuzzyScore('Combat', 'com')).toBeGreaterThan(fuzzyScore('Character combat', 'cmt'));
    expect(fuzzyScore('Combat', 'xyz')).toBe(0);
    expect(fuzzyScore('Anything', '')).toBe(1);
  });
});

describe('note graph', () => {
  it('builds note links and optional tag, attachment and unresolved nodes', () => {
    const index = buildIndex(notes);
    const plain = buildGraph(index);
    expect(plain.nodes.map((node) => node.label).sort()).toEqual(['Combat', 'Lore', 'Orphan', 'Stamina']);
    expect(plain.edges).toEqual([{ source: 'note:a', target: 'note:b' }]);

    const full = buildGraph(index, {
      showTags: true,
      showAttachments: true,
      showOrphans: false,
      showUnresolved: true,
      include: () => true,
      groupOf: (item) => (item.id === 'a' ? 0 : null),
      focus: null,
    });
    const labels = full.nodes.map((node) => node.label);
    expect(labels).toContain('#core');
    expect(labels).toContain('World map');
    expect(labels).toContain('Missing');
    expect(labels).not.toContain('Orphan');
    expect(full.nodes.find((node) => node.noteId === 'a')?.group).toBe(0);
  });

  it('limits a local graph to the focus note and its neighbours', () => {
    const local = buildGraph(buildIndex(notes), {
      showTags: false,
      showAttachments: false,
      showOrphans: true,
      showUnresolved: false,
      include: () => true,
      groupOf: () => null,
      focus: { noteId: 'b', depth: 1 },
    });
    expect(local.nodes.map((node) => node.label).sort()).toEqual(['Combat', 'Stamina']);
  });
});

describe('note templates', () => {
  it('fills values and recognises template folders', () => {
    const values = templateValues('Boss', new Date(2026, 9, 18, 9, 5));
    expect(applyTemplate('# {{title}} {{ date }} {{TIME}}', values)).toBe('# Boss 2026-10-18 09:05');
    const folders = [folder('t', 'Templates'), folder('child', 'Characters', 't'), folder('other', 'World')];
    expect(isTemplateFolder(folders, 'child')).toBe(true);
    expect(isTemplateFolder(folders, 'other')).toBe(false);
    expect(isTemplateFolder(folders, null)).toBe(false);
  });
});

describe('notes store', () => {
  it('debounces body edits, flushes them and merges renamed links', async () => {
    vi.useFakeTimers();
    const fake = createNotesFake();
    await bootNotes(fake.api, true);
    const target = await createNote({ title: 'Combat' });
    const source = await createNote({ title: 'Overview', body: 'See [[Combat]]' });

    editNoteBody(source.id, 'See [[Combat]] now');
    editNoteBody(source.id, 'See [[Combat]] today');
    expect(fake.api.updateNote).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(fake.api.updateNote).toHaveBeenCalledTimes(1);
    expect(fake.data.notes.find((item) => item.id === source.id)?.body).toBe('See [[Combat]] today');

    editNoteBody(source.id, 'Pending [[Combat]]');
    await flushNotes();
    expect(fake.data.notes.find((item) => item.id === source.id)?.body).toBe('Pending [[Combat]]');

    const changed = await updateNote(target.id, { title: 'Fighting' });
    expect(changed.map((item) => item.title)).toEqual(['Fighting', 'Overview']);
    expect(changed[1]?.body).toBe('Pending [[Fighting]]');
  });
});
