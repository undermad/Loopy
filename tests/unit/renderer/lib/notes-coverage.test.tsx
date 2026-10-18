import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssetFolder } from '@shared/assets';
import type { Note } from '@shared/notes';
import { closeProject, openProject } from '@renderer/lib/project';
import {
  applyTemplate,
  bootNotes,
  buildGraph,
  buildIndex,
  createNote,
  deleteNotes,
  editNoteBody,
  exportNotes,
  findNote,
  flushNotes,
  fuzzyScore,
  importNoteFiles,
  isTemplateFolder,
  isoDay,
  listNoteVersions,
  loadNotes,
  mergeNotes,
  nextNoteTitle,
  parseQuery,
  pickNotes,
  resetNotesStore,
  resolveNote,
  restoreNoteVersion,
  searchNotes,
  setActiveNote,
  templateValues,
  unlinkedMentions,
  updateNote,
  useActiveNoteId,
  useNote,
  useNoteIndex,
  useNotes,
  useNotesLoaded,
  userTemplates,
} from '@renderer/lib/notes';
import { bootTestApp, makeProject } from '../helpers/api';
import { createNotesFake } from '../helpers/notes-fake';

const STAMP = '2026-10-17T09:00:00.000Z';

function note(id: string, title: string, body: string, folderId: string | null = null): Note {
  return { id, title, body, folderId, starred: false, createdAt: STAMP, updatedAt: STAMP };
}

function folder(id: string, name: string, parentId: string | null = null): AssetFolder {
  return { id, name, parentId, scope: 'notes', createdAt: STAMP, updatedAt: STAMP };
}

function activeId(): string | null {
  const { result, unmount } = renderHook(() => useActiveNoteId());
  const value = result.current;
  unmount();
  return value;
}

afterEach(() => {
  resetNotesStore();
  vi.useRealTimers();
});

describe('notes project switching', () => {
  it('resets and reloads notes when the project changes', async () => {
    vi.useFakeTimers();
    const project = makeProject('Game');
    const api = await bootTestApp({}, 'light', (fake) => {
      fake.projects = [project];
      fake.current = project;
    });
    const item = await createNote({ title: 'Item' });
    setActiveNote(item.id);
    editNoteBody(item.id, 'never sent');

    await act(async () => {
      await closeProject();
    });
    expect(activeId()).toBeNull();
    const { result } = renderHook(() => useNotesLoaded());
    expect(result.current).toBe(false);
    await vi.advanceTimersByTimeAsync(500);
    expect(api.updateNote).not.toHaveBeenCalled();

    await act(async () => {
      await openProject(project.id);
    });
    await vi.waitFor(() => {
      expect(result.current).toBe(true);
    });
    expect(findNote(item.id)?.title).toBe('Item');
  });
});

describe('notes store actions', () => {
  it('throws before the store is booted', async () => {
    await expect(loadNotes()).rejects.toThrow('Notes are not loaded');
    await expect(flushNotes()).resolves.toBeUndefined();
  });

  it('skips loading notes when there is no project', async () => {
    const fake = createNotesFake();
    await bootNotes(fake.api, false);
    expect(fake.api.listNotes).not.toHaveBeenCalled();
    expect(findNote('anything')).toBeNull();
    expect(nextNoteTitle('Untitled')).toBe('Untitled');
  });

  it('clears the active note only when it is deleted', async () => {
    const fake = createNotesFake();
    await bootNotes(fake.api, true);
    const one = await createNote({ title: 'One' });
    const two = await createNote({ title: 'Two' });
    setActiveNote(one.id);
    setActiveNote(one.id);
    expect(activeId()).toBe(one.id);

    await deleteNotes([two.id]);
    expect(activeId()).toBe(one.id);

    editNoteBody(one.id, 'never saved');
    const left = await deleteNotes([one.id]);
    expect(left).toEqual([]);
    expect(activeId()).toBeNull();
    expect(fake.api.updateNote).not.toHaveBeenCalled();

    setActiveNote(null);
    await deleteNotes([]);
    expect(activeId()).toBeNull();
  });

  it('imports nothing for an empty list or a cancelled import', async () => {
    const fake = createNotesFake();
    await bootNotes(fake.api, true);
    expect(await importNoteFiles([], null)).toEqual([]);
    expect(fake.api.importNotes).not.toHaveBeenCalled();

    vi.mocked(fake.api.importNotes).mockResolvedValueOnce({ status: 'cancelled' });
    expect(await importNoteFiles([{ path: 'a.md', body: 'A' }], null)).toEqual([]);

    const ids = await importNoteFiles([{ path: 'dir/Imported.md', body: 'Body' }], 'folder');
    expect(ids).toHaveLength(1);
    expect(findNote(ids[0] ?? '')?.folderId).toBe('folder');
  });

  it('picks notes after flushing pending edits', async () => {
    vi.useFakeTimers();
    const fake = createNotesFake();
    await bootNotes(fake.api, true);
    const draft = await createNote({ title: 'Draft' });
    editNoteBody(draft.id, 'saved before picking');

    expect(await pickNotes('files', null)).toEqual([]);
    expect(fake.data.notes[0]?.body).toBe('saved before picking');

    vi.mocked(fake.api.pickNotes).mockImplementationOnce(() => {
      const picked = note('picked', 'Picked', 'from disk');
      fake.data.notes.push(picked);
      return Promise.resolve({ status: 'imported', notes: [...fake.data.notes], ids: ['picked'] });
    });
    editNoteBody(draft.id, 'pending again');
    const ids = await pickNotes('folder', 'target');
    expect(ids).toEqual(['picked']);
    expect(fake.api.pickNotes).toHaveBeenLastCalledWith('folder', 'target');
    expect(findNote('picked')?.title).toBe('Picked');
    expect(findNote(draft.id)?.body).toBe('pending again');
    await vi.advanceTimersByTimeAsync(500);
  });

  it('flushes pending edits before exporting and ignores failed saves', async () => {
    const fake = createNotesFake();
    await bootNotes(fake.api, true);
    const first = await createNote({ title: 'First' });
    const second = await createNote({ title: 'Second' });
    editNoteBody(first.id, 'first edit');
    editNoteBody(second.id, 'second edit');
    vi.mocked(fake.api.updateNote).mockRejectedValueOnce(new Error('disk full'));

    const result = await exportNotes({ ids: [first.id, second.id] });
    expect(result).toEqual({ status: 'exported' });
    expect(fake.api.updateNote).toHaveBeenCalledTimes(2);
    expect(fake.data.notes.find((item) => item.id === second.id)?.body).toBe('second edit');
  });

  it('merges a pending body into a patch unless the patch has its own body', async () => {
    const fake = createNotesFake();
    await bootNotes(fake.api, true);
    const item = await createNote({ title: 'Item' });

    editNoteBody(item.id, 'typed');
    await updateNote(item.id, { starred: true });
    expect(fake.api.updateNote).toHaveBeenLastCalledWith(item.id, { starred: true, body: 'typed' });

    editNoteBody(item.id, 'typed again');
    await updateNote(item.id, { body: 'explicit' });
    expect(fake.api.updateNote).toHaveBeenLastCalledWith(item.id, { body: 'explicit' });

    await updateNote(item.id, { folderId: null });
    expect(fake.api.updateNote).toHaveBeenLastCalledWith(item.id, { folderId: null });
    expect(findNote(item.id)?.body).toBe('explicit');
  });

  it('keeps pending bodies when notes reload and drops stale loads', async () => {
    const fake = createNotesFake();
    await bootNotes(fake.api, true);
    const item = await createNote({ title: 'Item', body: 'saved' });
    editNoteBody(item.id, 'unsaved');
    const loaded = await loadNotes();
    expect(loaded[0]?.body).toBe('saved');
    expect(findNote(item.id)?.body).toBe('unsaved');

    let release: () => void = () => undefined;
    vi.mocked(fake.api.listNotes).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => {
            resolve([note(item.id, 'Stale', 'stale')]);
          };
        }),
    );
    const slow = loadNotes();
    await updateNote(item.id, { title: 'Fresh' });
    release();
    await slow;
    expect(findNote(item.id)?.title).toBe('Fresh');
  });

  it('saves a debounced edit and stores notes created before a load', async () => {
    vi.useFakeTimers();
    const fake = createNotesFake();
    await bootNotes(fake.api, false);
    const item = await createNote({ title: 'Early' });
    expect(nextNoteTitle('early')).toBe('early 2');
    editNoteBody(item.id, 'later');
    await vi.advanceTimersByTimeAsync(500);
    expect(fake.api.updateNote).toHaveBeenCalledWith(item.id, { body: 'later' });
    expect(fake.data.notes[0]?.body).toBe('later');

    vi.mocked(fake.api.updateNote).mockRejectedValueOnce(new Error('offline'));
    editNoteBody(item.id, 'lost');
    await vi.advanceTimersByTimeAsync(500);
    expect(fake.data.notes[0]?.body).toBe('later');
    expect(findNote(item.id)?.body).toBe('lost');
  });

  it('ignores body edits before notes load', async () => {
    const fake = createNotesFake();
    await bootNotes(fake.api, false);
    editNoteBody('missing', 'text');
    await flushNotes();
    expect(fake.api.updateNote).not.toHaveBeenCalled();
  });

  it('skips a debounced save when the edit was already sent', async () => {
    vi.useFakeTimers();
    const fake = createNotesFake();
    await bootNotes(fake.api, true);
    const item = await createNote({ title: 'Item' });
    editNoteBody(item.id, 'edit');
    await updateNote(item.id, { title: 'Renamed' });
    await vi.advanceTimersByTimeAsync(500);
    expect(fake.api.updateNote).toHaveBeenCalledTimes(1);
  });

  it('moves the active note to the merge target', async () => {
    const fake = createNotesFake();
    await bootNotes(fake.api, true);
    const source = await createNote({ title: 'Source', body: 'from source' });
    const target = await createNote({ title: 'Target', body: 'target' });
    const other = await createNote({ title: 'Other' });

    setActiveNote(source.id);
    const merged = await mergeNotes(source.id, target.id);
    expect(merged.map((item) => item.title)).toEqual(['Other', 'Target']);
    expect(activeId()).toBe(target.id);
    expect(findNote(target.id)?.body).toContain('from source');

    const third = await createNote({ title: 'Third' });
    setActiveNote(other.id);
    await mergeNotes(third.id, target.id);
    expect(activeId()).toBe(other.id);
  });

  it('lists and restores note versions', async () => {
    const fake = createNotesFake();
    await bootNotes(fake.api, true);
    const item = await createNote({ title: 'Item', body: 'first' });
    await updateNote(item.id, { body: 'second' });
    editNoteBody(item.id, 'third');

    const versions = await listNoteVersions(item.id);
    expect(versions.map((version) => version.body)).toEqual(['second', 'first']);

    const restored = await restoreNoteVersion(versions[1]?.id ?? '');
    expect(restored[0]?.body).toBe('first');
    expect(findNote(item.id)?.body).toBe('first');
  });
});

describe('notes hooks', () => {
  it('reads notes, a single note, the active id and the index', async () => {
    const fake = createNotesFake();
    const notes = renderHook(() => useNotes());
    const loaded = renderHook(() => useNotesLoaded());
    expect(notes.result.current).toEqual([]);
    expect(loaded.result.current).toBe(false);

    await act(async () => {
      await bootNotes(fake.api, true);
    });
    const created = await act(() => createNote({ title: 'Hook', body: '[[Other]]' }));
    const single = renderHook(() => useNote(created.id));
    const missing = renderHook(() => useNote(null));
    const index = renderHook(() => useNoteIndex());

    expect(notes.result.current.map((item) => item.title)).toEqual(['Hook']);
    expect(loaded.result.current).toBe(true);
    expect(single.result.current?.title).toBe('Hook');
    expect(missing.result.current).toBeNull();
    expect([...index.result.current.unresolved.keys()]).toEqual(['other']);
    act(() => {
      setActiveNote(created.id);
    });
    expect(activeId()).toBe(created.id);
  });
});

describe('note search fields', () => {
  const notes = [
    note(
      'a',
      'Combat',
      '---\nstatus: draft\ncost: 3\nnone:\nlabels: [alpha, beta]\n---\nline one combat\n- [ ] tune combat\n- [x] ship',
    ),
    note('b', 'Stamina', 'a\na\na\na\na\na\na', 'world'),
    note('c', 'Lore', 'foo:bar here\n"quoted value"'),
  ];
  const index = buildIndex(notes);
  const path = (item: Note) => (item.folderId === 'world' ? 'Root/World' : 'Root');
  const titles = (query: string) => searchNotes(index, query, path).map((hit) => hit.note.title);

  it('parses every field alias and quoted values', () => {
    expect(parseQuery('title:Com file:sta folder:"Root/World" task:tune task-done:ship')).toEqual([
      { field: 'title', value: 'Com', negate: false },
      { field: 'title', value: 'sta', negate: false },
      { field: 'path', value: 'Root/World', negate: false },
      { field: 'task', value: 'tune', negate: false },
      { field: 'done', value: 'ship', negate: false },
    ]);
    expect(parseQuery('foo:bar # #lore "" -[status]')).toEqual([
      { field: 'text', value: 'foo:bar', negate: false },
      { field: 'text', value: '#', negate: false },
      { field: 'tag', value: 'lore', negate: false },
      { field: 'property', key: 'status', value: '', negate: true },
    ]);
  });

  it('matches titles, paths and tasks', () => {
    expect(titles('title:com')).toEqual(['Combat']);
    expect(titles('file:STA')).toEqual(['Stamina']);
    expect(titles('folder:world')).toEqual(['Stamina']);
    expect(titles('task:tune')).toEqual(['Combat']);
    expect(titles('task:ship')).toEqual(['Combat']);
    expect(titles('task-done:ship')).toEqual(['Combat']);
    expect(titles('task-done:tune')).toEqual([]);
    expect(searchNotes(index, 'task:combat')[0]?.lines).toEqual(['tune combat']);
  });

  it('treats unknown fields as text and supports quoted text', () => {
    expect(titles('foo:bar')).toEqual(['Lore']);
    expect(titles('"quoted value"')).toEqual(['Lore']);
  });

  it('matches and negates property terms', () => {
    expect(titles('[status]')).toEqual(['Combat']);
    expect(titles('[status:dra]')).toEqual(['Combat']);
    expect(titles('[cost:3]')).toEqual(['Combat']);
    expect(titles('[none:x]')).toEqual([]);
    expect(titles('[none:]')).toEqual(['Combat']);
    expect(titles('-[status:draft]')).toEqual(['Stamina', 'Lore']);
    expect(titles('[missing]')).toEqual([]);
    expect(titles('[LABELS:beta]')).toEqual(['Combat']);
  });

  it('de-duplicates lines and caps them at five', () => {
    const hit = searchNotes(index, 'a', path).find((item) => item.note.id === 'b');
    expect(hit?.lines).toEqual(['a']);
    const many = buildIndex([note('m', 'Many', 'x1\nx2\nx3\nx4\nx5\nx6\nx7')]);
    expect(searchNotes(many, 'x')[0]?.lines).toEqual(['x1', 'x2', 'x3', 'x4', 'x5']);
    expect(searchNotes(many, 'x title:many')[0]?.lines).toHaveLength(5);
  });

  it('matches by title alone with no lines', () => {
    expect(searchNotes(index, 'lore')[0]?.lines).toEqual([]);
    expect(searchNotes(index, '   ')).toEqual([]);
  });

  it('matches nested tags', () => {
    const tagged = buildIndex([note('t', 'Tagged', '#world/east'), note('u', 'Plain', '')]);
    expect(searchNotes(tagged, 'tag:world').map((hit) => hit.note.id)).toEqual(['t']);
    expect(searchNotes(tagged, '-#world').map((hit) => hit.note.id)).toEqual(['u']);
  });
});

describe('fuzzy scoring', () => {
  it('prefers earlier and tighter matches', () => {
    expect(fuzzyScore('Combat', '  ')).toBe(1);
    expect(fuzzyScore('Combat', 'com')).toBeGreaterThan(fuzzyScore('Big combat', 'com'));
    expect(fuzzyScore('Combat', 'cbt')).toBe(5);
    expect(fuzzyScore('Combat', 'cot')).toBe(7);
    expect(fuzzyScore('Combat', 'cz')).toBe(0);
  });
});

describe('note graph options', () => {
  const notes = [
    note('a', 'A', '[[B]] [[B]] [[#Self]] [[asset:#frame]] ![[asset:Hero.png]] [[Ghost]] #tag'),
    note('b', 'B', '[[C]] [[A]]'),
    note('c', 'C', '[[D]]'),
    note('d', 'D', ''),
    note('e', 'E', '[[Hidden]]'),
    note('h', 'Hidden', ''),
  ];
  const index = buildIndex(notes);
  const base = {
    showTags: false,
    showAttachments: false,
    showOrphans: true,
    showUnresolved: false,
    include: () => true,
    groupOf: () => null,
    focus: null,
  };

  it('defaults to every note with deduplicated edges', () => {
    const graph = buildGraph(index);
    expect(graph.nodes).toHaveLength(6);
    expect(graph.edges).toEqual([
      { source: 'note:a', target: 'note:b' },
      { source: 'note:b', target: 'note:c' },
      { source: 'note:c', target: 'note:d' },
      { source: 'note:e', target: 'note:h' },
    ]);
    expect(graph.nodes.find((node) => node.id === 'note:b')?.degree).toBe(2);
  });

  it('drops excluded notes and links to them', () => {
    const graph = buildGraph(index, { ...base, include: (item) => item.id !== 'h' });
    expect(graph.nodes.map((node) => node.id)).not.toContain('note:h');
    expect(graph.edges.some((edge) => edge.target === 'note:h')).toBe(false);
  });

  it('skips attachments with an empty target and adds unresolved links', () => {
    const graph = buildGraph(index, { ...base, showAttachments: true, showUnresolved: true, showTags: true });
    const ids = graph.nodes.map((node) => node.id);
    expect(ids).toContain('asset:hero.png');
    expect(ids).toContain('unresolved:ghost');
    expect(ids).toContain('tag:tag');
    expect(ids.some((id) => id === 'asset:')).toBe(false);
  });

  it('follows the focus to the requested depth', () => {
    const depth = (value: number) =>
      buildGraph(index, { ...base, focus: { noteId: 'a', depth: value } })
        .nodes.map((node) => node.id)
        .sort();
    expect(depth(0)).toEqual(['note:a']);
    expect(depth(2)).toEqual(['note:a', 'note:b', 'note:c']);
  });

  it('hides orphans and shares nodes between notes', () => {
    const shared = buildIndex([
      note('x', 'X', '[[Ghost]] #same'),
      note('y', 'Y', '[[Ghost]] #same'),
      note('z', 'Z', ''),
    ]);
    const graph = buildGraph(shared, { ...base, showOrphans: false, showUnresolved: true, showTags: true });
    expect(graph.nodes.map((node) => node.id).sort()).toEqual([
      'note:x',
      'note:y',
      'tag:same',
      'unresolved:ghost',
    ]);
    expect(graph.nodes.find((node) => node.id === 'tag:same')?.degree).toBe(2);
    const lonely = buildGraph(shared, { ...base, focus: { noteId: 'z', depth: 1 } });
    expect(lonely.nodes.map((node) => node.id)).toEqual(['note:z']);
  });

  it('returns nothing when the focus note is not in the graph', () => {
    const graph = buildGraph(index, { ...base, focus: { noteId: 'missing', depth: 2 } });
    expect(graph).toEqual({ nodes: [], edges: [] });
    const hidden = buildGraph(index, {
      ...base,
      include: (item) => item.id !== 'a',
      focus: { noteId: 'a', depth: 1 },
    });
    expect(hidden.nodes).toEqual([]);
  });
});

describe('note templates and links', () => {
  it('leaves unknown placeholders untouched and pads dates', () => {
    const values = templateValues('Boss', new Date(2026, 0, 5, 7, 3));
    expect(values).toEqual({ title: 'Boss', date: '2026-01-05', time: '07:03' });
    expect(applyTemplate('{{author}} {{ Title }} {{date', values)).toBe('{{author}} Boss {{date');
    expect(isoDay(new Date(999, 11, 31))).toBe('999-12-31');
  });

  it('handles missing folders and cycles when finding template folders', () => {
    const folders = [
      folder('loop-a', 'A', 'loop-b'),
      folder('loop-b', 'B', 'loop-a'),
      folder('orphan', 'Orphan', 'gone'),
      folder('t', ' templates '),
    ];
    expect(isTemplateFolder(folders, 'missing')).toBe(false);
    expect(isTemplateFolder(folders, 'loop-a')).toBe(false);
    expect(isTemplateFolder(folders, 'orphan')).toBe(false);
    expect(isTemplateFolder(folders, 't')).toBe(true);
    expect(
      userTemplates([note('x', 'X', '', 't'), note('y', 'Y', '', 'loop-a'), note('z', 'Z', '')], folders).map(
        (item) => item.id,
      ),
    ).toEqual(['x']);
  });

  it('keeps the first alias owner and ignores mentions of unknown notes', () => {
    const index = buildIndex([
      note('a', 'Alpha', '---\naliases: [Shared]\n---\n'),
      note('b', 'Beta', '---\naliases: [shared, alpha]\n---\nAlpha and Shared'),
    ]);
    expect(resolveNote(index, 'Shared')?.id).toBe('a');
    expect(resolveNote(index, 'alpha.MD')?.id).toBe('a');
    expect(resolveNote(index, 'nobody')).toBeNull();
    expect(unlinkedMentions(index, 'missing')).toEqual([]);
    expect(unlinkedMentions(index, 'a').map((mention) => mention.context)).toEqual([
      'Alpha and Shared',
      'Alpha and Shared',
    ]);
  });

  it('records self links without backlinks and repeated unresolved sources once', () => {
    const index = buildIndex([note('a', 'Alpha', '[[#Top]] [[Ghost]] [[ghost]] #x #X')]);
    expect(index.backlinks.size).toBe(0);
    expect(index.outgoing.get('a')?.[0]?.targetId).toBe('a');
    const again = buildIndex([note('a', 'Renamed', '[[#Top]] [[Ghost]] [[ghost]] #x #X')]);
    expect(again.parsed.get('a')).toBe(index.parsed.get('a'));
    expect([...index.unresolved.values()]).toEqual([{ name: 'Ghost', sources: ['a'] }]);
    expect(index.tags.get('x')?.noteIds).toEqual(['a']);
  });
});
