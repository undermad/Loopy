import { useState, type ComponentType } from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { currentCompletions, startCompletion, type Completion } from '@codemirror/autocomplete';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LayoutNode } from '@shared/layout';
import { noteCompletion, type CompletionData } from '@renderer/components/editors/Notes/codemirror/complete';
import { NoteEditor } from '@renderer/components/editors/Notes/NoteEditor';
import type { EditorProps } from '@renderer/lib/editors';
import { importFiles, reportAssetDrag } from '@renderer/lib/assets';
import { createBoard } from '@renderer/lib/board';
import { createNote, editNoteBody, findNote, updateNote } from '@renderer/lib/notes';
import { createPalette } from '@renderer/lib/palettes';
import { ticketActions, useSelectedTicketId } from '@renderer/lib/tickets';
import { useWorkspaces } from '@renderer/lib/workspaces';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function areasOf(node: LayoutNode): { id: string; editor: string; state: Record<string, unknown> }[] {
  return node.kind === 'area' ? [node] : node.children.flatMap(areasOf);
}

function areaOf(editor: string) {
  const workspaces = renderHook(() => useWorkspaces()).result.current;
  return workspaces.flatMap((workspace) => areasOf(workspace.root)).find((area) => area.editor === editor);
}

function Stateful({
  editor: Editor,
  initial = {},
  onState,
}: {
  editor: ComponentType<EditorProps>;
  initial?: Record<string, unknown>;
  onState?: ((state: Record<string, unknown>) => void) | undefined;
}) {
  const [state, setState] = useState(initial);
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <Editor
          areaId="test"
          state={state}
          setState={(patch) => {
            setState((current) => {
              const next = { ...current, ...patch };
              onState?.(next);
              return next;
            });
          }}
        />
      </ToastProvider>
    </TooltipProvider>
  );
}

function viewOf(container: HTMLElement): EditorView {
  const host = container.querySelector('.cm-editor');
  const view = host instanceof HTMLElement ? EditorView.findFromDOM(host) : null;
  if (!view) throw new Error('No editor view');
  return view;
}

function element(container: ParentNode, selector: string): HTMLElement {
  const found = container.querySelector(selector);
  if (!(found instanceof HTMLElement)) throw new Error(`Nothing matches ${selector}`);
  return found;
}

async function mount(initial: Record<string, unknown>, onState?: (state: Record<string, unknown>) => void) {
  const result = render(<Stateful editor={NoteEditor} initial={initial} onState={onState} />);
  await waitFor(() => {
    expect(result.container.querySelector('.cm-editor')).toBeInTheDocument();
  });
  return { ...result, view: viewOf(result.container) };
}

function docOf(container: HTMLElement): string {
  return viewOf(container).state.doc.toString();
}

function file(name: string, type: string, content = 'data'): File {
  return new File([content], name, { type });
}

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
  await waitFor(() => {
    expect(api.listNotes).toHaveBeenCalled();
  });
});

describe('note editor modes and anchors', () => {
  it('switches between live preview, source and reading', async () => {
    const user = userEvent.setup();
    await createNote({ title: 'Target', body: 'x' });
    const note = await createNote({ title: 'Modes', body: 'See [[Target]] now' });
    const { container } = await mount({ noteId: note.id });
    await waitFor(() => {
      expect(container.querySelector('.cm-wikilink')).toHaveTextContent('Target');
    });
    expect(element(container, '.cm-editor')).toHaveAttribute('data-mode', 'live');

    await user.click(screen.getByRole('radio', { name: 'Source' }));
    await waitFor(() => {
      expect(element(container, '.cm-editor')).toHaveAttribute('data-mode', 'source');
    });
    expect(container.querySelector('.cm-wikilink')).not.toBeInTheDocument();
    expect(element(container, '.cm-wikilink-source')).toHaveAttribute('data-kind', 'note');

    await user.click(screen.getByRole('radio', { name: 'Reading' }));
    expect(await screen.findByRole('link', { name: 'Target' })).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Live preview' }));
    await waitFor(() => {
      expect(element(container, '.cm-editor')).toHaveAttribute('data-mode', 'live');
    });
    expect(screen.queryByRole('link', { name: 'Target' })).not.toBeInTheDocument();
  });

  it('moves the cursor to a heading or block anchor in the editor', async () => {
    const body = 'Intro\n\n## Combat\nTwo hits ^combo\n\nEnd';
    const note = await createNote({ title: 'Anchors', body });
    const heading = await mount({ noteId: note.id, anchor: 'combat' });
    await waitFor(() => {
      expect(heading.view.state.selection.main.head).toBe(body.indexOf('## Combat'));
    });
    heading.unmount();

    const block = await mount({ noteId: note.id, anchor: '^combo' });
    await waitFor(() => {
      expect(block.view.state.selection.main.head).toBe(body.indexOf('Two hits'));
    });
    block.unmount();

    const missing = await mount({ noteId: note.id, anchor: 'Nowhere' });
    expect(missing.view.state.selection.main.head).toBe(0);
  });

  it('scrolls to a heading anchor in the reading view', async () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    const note = await createNote({ title: 'Reading anchor', body: '# Top\n\n## Deep dive\nText' });
    render(
      <Stateful editor={NoteEditor} initial={{ noteId: note.id, mode: 'reading', anchor: 'Deep dive' }} />,
    );
    await waitFor(() => {
      expect(scroll).toHaveBeenCalledWith({ block: 'start' });
    });
    expect(
      scroll.mock.contexts.some((target) => target instanceof HTMLElement && target.id === 'deep-dive'),
    ).toBe(true);
  });

  it('explains when the open note no longer exists', async () => {
    render(<Stateful editor={NoteEditor} initial={{ noteId: 'gone' }} />);
    expect(await screen.findByText('This note no longer exists')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Note title' })).not.toBeInTheDocument();
  });
});

describe('note editor header', () => {
  it('rejects invalid and taken titles and handles Enter and Escape', async () => {
    const user = userEvent.setup();
    await createNote({ title: 'Taken', body: '' });
    const note = await createNote({ title: 'Draft', body: 'Body' });
    const { view } = await mount({ noteId: note.id });
    const title = screen.getByRole('textbox', { name: 'Note title' });

    await user.clear(title);
    await user.type(title, 'Bad/name');
    fireEvent.blur(title);
    expect(await screen.findByText(/Titles cannot contain/)).toBeInTheDocument();
    expect(title).toHaveValue('Draft');

    await user.clear(title);
    await user.type(title, 'Taken');
    fireEvent.blur(title);
    expect(await screen.findByText('A note called Taken already exists')).toBeInTheDocument();
    expect(findNote(note.id)?.title).toBe('Draft');

    await user.clear(title);
    await user.type(title, 'Abandoned');
    fireEvent.keyDown(title, { key: 'Escape' });
    expect(title).toHaveValue('Draft');
    expect(view.hasFocus).toBe(true);

    title.focus();
    fireEvent.keyDown(title, { key: 'Enter' });
    expect(view.hasFocus).toBe(true);
    fireEvent.blur(title);
    expect(api.updateNote).not.toHaveBeenCalledWith(note.id, expect.objectContaining({ title: 'Draft' }));

    await user.clear(title);
    await user.type(title, 'Renamed');
    fireEvent.blur(title);
    await waitFor(() => {
      expect(findNote(note.id)?.title).toBe('Renamed');
    });
    expect(screen.queryByText(/Updated links/)).not.toBeInTheDocument();
  });

  it('adds and removes the bookmark', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Starry', body: '' });
    await mount({ noteId: note.id });
    await user.click(screen.getByRole('button', { name: 'Bookmark' }));
    await waitFor(() => {
      expect(findNote(note.id)?.starred).toBe(true);
    });
    await user.click(await screen.findByRole('button', { name: 'Remove bookmark' }));
    await waitFor(() => {
      expect(findNote(note.id)?.starred).toBe(false);
    });
  });

  it('opens a tag from the tag bar', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Tagged', body: 'Robots #enemy' });
    await mount({ noteId: note.id });
    const tags = screen.getByLabelText('Tags');
    await user.click(within(tags).getByRole('button', { name: '#enemy' }));
    expect(areaOf('notes')?.state['search']).toBe('tag:#enemy');
  });

  it('walks back and forward through visited notes', async () => {
    const user = userEvent.setup();
    const first = await createNote({ title: 'First', body: 'Go [[Second]]' });
    const second = await createNote({ title: 'Second', body: 'Go [[Third]]' });
    const third = await createNote({ title: 'Third', body: 'End' });
    const changes = vi.fn();
    const { container } = await mount({ noteId: first.id }, changes);
    const title = screen.getByRole('textbox', { name: 'Note title' });

    const follow = async (name: string) => {
      const widget = await waitFor(() => element(container, `.cm-wikilink[data-wikilink="[[${name}]]"]`));
      fireEvent.mouseDown(widget);
      await waitFor(() => {
        expect(title).toHaveValue(name);
      });
    };
    await follow('Second');
    await follow('Third');
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ noteId: third.id }));
    expect(screen.getByRole('button', { name: 'Forward' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(title).toHaveValue('Second');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(title).toHaveValue('First');
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Forward' }));
    expect(title).toHaveValue('Second');
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ noteId: second.id, anchor: null }));
    await user.click(screen.getByRole('button', { name: 'Forward' }));
    expect(title).toHaveValue('Third');
  });
});

describe('note editor menu', () => {
  it('exports the note with and without Loopy links', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Export me', body: 'Text' });
    await mount({ noteId: note.id });
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Export as Markdown' }));
    await waitFor(() => {
      expect(api.exportNotes).toHaveBeenLastCalledWith({ ids: [note.id], loopyLinks: 'keep' });
    });
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Export with plain links' }));
    await waitFor(() => {
      expect(api.exportNotes).toHaveBeenLastCalledWith({ ids: [note.id], loopyLinks: 'plain' });
    });
  });

  it('copies a link to the note', async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    const note = await createNote({ title: 'Linkable', body: '' });
    await mount({ noteId: note.id });
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Copy link' }));
    expect(write).toHaveBeenCalledWith('[[Linkable]]');
    expect(await screen.findByText('Link copied')).toBeInTheDocument();
  });

  it('creates tickets from a selection, a task line or the note title', async () => {
    const user = userEvent.setup();
    const body = 'Fix the jump arc\n- [ ] Tune gravity\nPlain line';
    const note = await createNote({ title: 'Platforming', body });
    const { container, view } = await mount({ noteId: note.id });
    const create = async () => {
      await user.click(screen.getByRole('button', { name: 'More' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Create ticket from selection' }));
    };

    act(() => {
      view.dispatch({ selection: { anchor: 0, head: 'Fix the jump arc'.length } });
    });
    await create();
    expect(await screen.findByText('Created ticket 1')).toBeInTheDocument();
    expect(api.createTicket).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Fix the jump arc', description: '[[Platforming]]' }),
    );
    expect(api.updateTicket).toHaveBeenLastCalledWith('ticket-1', { links: [{ kind: 'note', id: note.id }] });
    expect(docOf(container).split('\n')[0]).toBe('Fix the jump arc [[ticket:1]]');

    const taskLine = docOf(container).indexOf('Tune');
    act(() => {
      view.dispatch({ selection: { anchor: taskLine } });
    });
    await create();
    expect(await screen.findByText('Created ticket 2')).toBeInTheDocument();
    expect(api.createTicket).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Tune gravity' }));
    expect(docOf(container).split('\n')[1]).toBe('- [ ] Tune gravity [[ticket:2]]');

    const plain = docOf(container).indexOf('Plain');
    act(() => {
      view.dispatch({ selection: { anchor: plain } });
    });
    await create();
    expect(await screen.findByText('Created ticket 3')).toBeInTheDocument();
    expect(api.createTicket).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Platforming' }));
    expect(docOf(container).split('\n')[2]).toBe('Plain line [[ticket:3]]');
  });

  it('inserts a template at the cursor', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Goblin', body: '' });
    const { container } = await mount({ noteId: note.id });
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Insert template' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Enemy' }));
    await waitFor(() => {
      expect(docOf(container)).toContain('type: enemy');
    });
    expect(docOf(container)).toContain('# Goblin');
    expect(screen.queryByRole('menuitem', { name: 'Blank note' })).not.toBeInTheDocument();
  });

  it('deletes the note after confirmation', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Doomed', body: '' });
    const changes = vi.fn();
    await mount({ noteId: note.id }, changes);
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete note' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete Doomed?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete note' }));
    await waitFor(() => {
      expect(api.deleteNotes).toHaveBeenCalledWith([note.id]);
    });
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ noteId: null }));
    expect(await screen.findByText('No note open')).toBeInTheDocument();
  });
});

describe('note editor body sync', () => {
  it('saves local edits and applies remote changes to the open editor', async () => {
    const note = await createNote({ title: 'Synced', body: 'Hello world' });
    const { container, view } = await mount({ noteId: note.id });
    act(() => {
      view.dispatch({ changes: { from: 5, insert: ' there' } });
    });
    expect(findNote(note.id)?.body).toBe('Hello there world');

    act(() => {
      editNoteBody(note.id, 'Hello brave world');
    });
    await waitFor(() => {
      expect(docOf(container)).toBe('Hello brave world');
    });

    await act(async () => {
      await updateNote(note.id, { body: 'Goodbye' });
    });
    await waitFor(() => {
      expect(docOf(container)).toBe('Goodbye');
    });
    expect(findNote(note.id)?.body).toBe('Goodbye');
  });
});

describe('note editor imports', () => {
  it('imports dropped Markdown and files as links and embeds', async () => {
    const note = await createNote({ title: 'Inbox', body: '' });
    const { container, view } = await mount({ noteId: note.id });
    fireEvent.drop(view.contentDOM, {
      dataTransfer: {
        files: [
          file('Lore.md', 'text/markdown', '# Lore'),
          file('hero.png', 'image/png'),
          file('spec.pdf', 'application/pdf'),
        ],
      },
      clientX: 0,
      clientY: 0,
    });
    await waitFor(() => {
      expect(docOf(container)).toBe('[[Lore]] ![[asset:hero.png]] [[asset:spec.pdf]]');
    });
    expect(api.importNotes).toHaveBeenCalledWith(
      expect.objectContaining({ files: [{ path: 'Lore.md', body: '# Lore' }] }),
    );
    expect(api.importAssets).toHaveBeenCalledTimes(1);
    expect(findNote(api.notesData.notes.find((item) => item.title === 'Lore')?.id ?? null)?.body).toBe(
      '# Lore',
    );
  });

  it('imports pasted files and ignores drops and pastes without files', async () => {
    const note = await createNote({ title: 'Paste', body: 'Start' });
    const { container, view } = await mount({ noteId: note.id });
    act(() => {
      view.dispatch({ selection: { anchor: 5 } });
    });
    fireEvent.drop(view.contentDOM, { dataTransfer: { files: [], getData: () => '' } });
    fireEvent.paste(view.contentDOM, { clipboardData: { files: [], getData: () => '' } });
    expect(api.importAssets).not.toHaveBeenCalled();
    expect(api.importNotes).not.toHaveBeenCalled();

    fireEvent.paste(view.contentDOM, { clipboardData: { files: [file('clip.mp3', 'audio/mpeg')] } });
    await waitFor(() => {
      expect(docOf(container)).toBe('Start![[asset:clip.mp3]]');
    });
  });

  it('inserts links for assets, notes, boards and palettes dropped from other panels', async () => {
    await importFiles([file('hero.png', 'image/png'), file('spec.pdf', 'application/pdf')], 'auto');
    const [image, pdf] = api.assetsData.snapshot.assets;
    const board = await createBoard({ name: 'World map' });
    const palette = await createPalette({
      name: 'Dusk',
      harmony: 'custom',
      baseIndex: 0,
      source: 'wheel',
      colours: [{ name: '', hex: '#ff8800' }],
    });
    const other = await createNote({ title: 'Other', body: '' });
    const note = await createNote({ title: 'Board drop', body: '' });
    const { container } = await mount({ noteId: note.id });
    const zone = element(container, '[data-asset-drop]');
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([zone]);

    act(() => {
      reportAssetDrag([image?.id ?? ''], 0, 0, 'move');
    });
    expect(docOf(container)).toBe('');

    act(() => {
      reportAssetDrag(['missing'], 0, 0, 'drop', [
        { kind: 'note', id: note.id },
        { kind: 'board', id: 'nope' },
        { kind: 'palette', id: 'nope' },
        { kind: 'note', id: 'nope' },
      ]);
    });
    expect(docOf(container)).toBe('');

    act(() => {
      reportAssetDrag([image?.id ?? '', pdf?.id ?? ''], 0, 0, 'drop', [
        { kind: 'note', id: other.id },
        { kind: 'board', id: board.id },
        { kind: 'palette', id: palette.id },
      ]);
    });
    expect(docOf(container)).toBe(
      '![[asset:hero.png]] [[asset:spec.pdf]] [[Other]] [[board:World map]] ![[palette:Dusk]]',
    );
  });
});

describe('live preview widgets', () => {
  it('shows a hover preview after a delay and hides it again', async () => {
    await createNote({ title: 'Peek', body: 'Hidden depths' });
    const note = await createNote({ title: 'Hover', body: 'Look at [[Peek]] and text' });
    const { container, view } = await mount({ noteId: note.id });
    const widget = await waitFor(() => element(container, '.cm-wikilink'));

    fireEvent.mouseOver(widget);
    const tooltip = await screen.findByRole('tooltip', {}, { timeout: 2000 });
    expect(within(tooltip).getByText('Hidden depths')).toBeInTheDocument();

    fireEvent.mouseLeave(view.contentDOM);
    fireEvent.mouseEnter(tooltip);
    fireEvent.mouseLeave(tooltip);
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    fireEvent.mouseOver(widget);
    expect(await screen.findByRole('tooltip', {}, { timeout: 2000 })).toBeInTheDocument();
    fireEvent.mouseOver(view.contentDOM);
    await waitFor(
      () => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it('opens boards, palettes and tickets and creates missing notes from widgets', async () => {
    const board = await createBoard({ name: 'World map' });
    const palette = await createPalette({
      name: 'Dusk',
      harmony: 'custom',
      baseIndex: 0,
      source: 'wheel',
      colours: [{ name: '', hex: '#ff8800' }],
    });
    await ticketActions.create({ title: 'Implement combat', stateId: 'todo' });
    const note = await createNote({
      title: 'Hub',
      body: 'A [[board:World map]] B ![[palette:Dusk]] C [[ticket:1]] D [[Nowhere]] E [[board:Gone]]',
    });
    const { container } = await mount({ noteId: note.id });
    await waitFor(() => {
      expect(container.querySelector('.cm-wikilink-ticket')).toHaveTextContent('Implement combat');
    });

    fireEvent.mouseDown(element(container, '.cm-wikilink-board:not(.cm-wikilink-missing)'));
    await waitFor(() => {
      expect(areaOf('board')?.state['boardId']).toBe(board.id);
    });

    const swatch = element(container, '.cm-embed-palette .cm-swatch');
    expect(swatch.style.background).toBe('rgb(255, 136, 0)');
    fireEvent.mouseDown(swatch);
    await waitFor(() => {
      expect(areaOf('colours')?.state['paletteId']).toBe(palette.id);
    });

    fireEvent.mouseDown(element(container, '.cm-wikilink-ticket'));
    await waitFor(() => {
      expect(renderHook(() => useSelectedTicketId()).result.current).toBe('ticket-1');
    });

    fireEvent.mouseDown(element(container, '.cm-wikilink-board.cm-wikilink-missing'));
    fireEvent.mouseDown(element(container, '.cm-wikilink-note.cm-wikilink-missing'));
    await waitFor(() => {
      expect(api.notesData.notes.map((item) => item.title)).toContain('Nowhere');
    });
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Note title' })).toHaveValue('Nowhere');
    });
  });

  it('opens tags and web links only with Ctrl held', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const note = await createNote({
      title: 'Refs',
      body: 'See #design\n\n[docs](https://example.com) or [local](file.txt)',
    });
    const { container, view } = await mount({ noteId: note.id });
    const tag = await waitFor(() => element(container, '.cm-tag'));
    expect(tag).toHaveAttribute('data-tag', 'design');

    fireEvent.mouseDown(tag);
    expect(areaOf('notes')?.state['search']).not.toBe('tag:#design');
    fireEvent.mouseDown(tag, { ctrlKey: true });
    expect(areaOf('notes')?.state['search']).toBe('tag:#design');
    act(() => {
      view.contentDOM.blur();
      view.dispatch({ selection: { anchor: 0 } });
    });

    const [web, local] = Array.from(container.querySelectorAll('.cm-md-link'));
    expect(web).toHaveTextContent('docs');
    expect(container.querySelector('.cm-content')).not.toHaveTextContent('https://example.com');
    if (!(web instanceof HTMLElement) || !(local instanceof HTMLElement)) throw new Error('No links');
    fireEvent.mouseDown(web);
    expect(open).not.toHaveBeenCalled();
    fireEvent.mouseDown(web, { metaKey: true });
    expect(open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener');
    fireEvent.mouseDown(local, { ctrlKey: true });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('follows source links only with Ctrl and toggles task checkboxes', async () => {
    const user = userEvent.setup();
    const target = await createNote({ title: 'Goal', body: '' });
    const note = await createNote({ title: 'Tasks', body: '- [ ] Ship it\n- [x] Plan it\n\n[[Goal]]' });
    const changes = vi.fn();
    const { container, view } = await mount({ noteId: note.id }, changes);
    const boxes = await waitFor(() => {
      const found = container.querySelectorAll('input.cm-task');
      expect(found).toHaveLength(2);
      return Array.from(found);
    });
    const [open, done] = boxes;
    if (!(open instanceof HTMLInputElement) || !(done instanceof HTMLInputElement))
      throw new Error('No boxes');
    expect(open.checked).toBe(false);
    expect(done.checked).toBe(true);
    fireEvent.mouseDown(open);
    expect(view.state.doc.line(1).text).toBe('- [x] Ship it');
    fireEvent.mouseDown(container.querySelectorAll('input.cm-task')[1] ?? view.contentDOM);
    expect(view.state.doc.line(2).text).toBe('- [ ] Plan it');

    await user.click(screen.getByRole('radio', { name: 'Source' }));
    const source = await waitFor(() => element(container, '.cm-wikilink-source'));
    expect(container.querySelector('input.cm-task')).not.toBeInTheDocument();
    fireEvent.mouseDown(source);
    expect(changes).not.toHaveBeenCalledWith(expect.objectContaining({ noteId: target.id }));
    fireEvent.mouseDown(source, { ctrlKey: true });
    await waitFor(() => {
      expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ noteId: target.id }));
    });
  });

  it('toggles tasks from the reading view', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Read tasks', body: '- [x] Done\n- [ ] Todo' });
    render(<Stateful editor={NoteEditor} initial={{ noteId: note.id, mode: 'reading' }} />);
    const [done] = await screen.findAllByRole('checkbox');
    if (!done) throw new Error('No checkbox');
    await user.click(done);
    await waitFor(() => {
      expect(findNote(note.id)?.body).toBe('- [ ] Done\n- [ ] Todo');
    });
    const [, todo] = screen.getAllByRole('checkbox');
    if (!todo) throw new Error('No checkbox');
    await user.click(todo);
    await waitFor(() => {
      expect(findNote(note.id)?.body).toBe('- [ ] Done\n- [x] Todo');
    });
  });

  it('renders image embeds, labels subpaths and marks missing embeds', async () => {
    await importFiles([file('hero.png', 'image/png')], 'auto');
    const [image] = api.assetsData.snapshot.assets;
    await createNote({ title: 'Lore', body: '## Origins' });
    const note = await createNote({
      title: 'Embeds',
      body: '![[asset:hero.png]]\n\n[[Lore#Origins]] [[#Intro]] [[Lore|the lore]]\n\n![[palette:Missing]]',
    });
    const { container } = await mount({ noteId: note.id });
    const img = await waitFor(() => {
      const found = container.querySelector('.cm-embed-asset img');
      if (!(found instanceof HTMLImageElement)) throw new Error('No image');
      return found;
    });
    expect(img.src).toContain(image?.id ?? 'none');
    expect(img.alt).toBe('hero.png');
    const labels = Array.from(container.querySelectorAll('.cm-wikilink-note')).map(
      (item) => item.textContent,
    );
    expect(labels).toEqual(['Lore › Origins', 'Intro', 'the lore']);
    expect(element(container, '.cm-embed-palette')).toHaveClass('cm-wikilink-missing');
    expect(element(container, '.cm-embed-palette .cm-embed-label')).toHaveTextContent('Missing');
  });
});

describe('live preview markdown', () => {
  const body = [
    '---',
    'status: draft',
    '---',
    '## Heading two',
    '### Closed ###',
    '> [!Warning] Careful',
    '> Body',
    '> Plain quote',
    '',
    '> Just a quote',
    '',
    '```js',
    'const link = "[[Fake]] #inside ==no== %%hidden%%";',
    '```',
    '',
    '***',
    '',
    'Some **bold** and ==shine== with %%secret%% and `[[code]]`.',
  ].join('\n');

  it('decorates headings, callouts, code, rules, highlights and comments', async () => {
    const note = await createNote({ title: 'Markdown', body });
    const { container } = await mount({ noteId: note.id });
    await waitFor(() => {
      expect(container.querySelectorAll('.cm-frontmatter')).toHaveLength(3);
    });
    expect(element(container, '.cm-heading')).toHaveClass('cm-h2');
    expect(element(container, '.cm-heading')).toHaveTextContent(/^Heading two$/);
    expect(container.querySelectorAll('.cm-heading')[1]).toHaveTextContent(/^Closed ###$/);
    expect(element(container, '.cm-callout-title')).toHaveAttribute('data-callout', 'warning');
    expect(container.querySelectorAll('.cm-callout')).toHaveLength(3);
    expect(container.querySelectorAll('.cm-quote:not(.cm-callout)')).toHaveLength(1);
    expect(container.querySelectorAll('.cm-codeblock')).toHaveLength(3);
    expect(container.querySelector('.cm-codeblock .cm-wikilink')).not.toBeInTheDocument();
    expect(container.querySelector('.cm-codeblock .cm-tag')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.cm-rule')).toHaveLength(1);
    const front = container.querySelectorAll('.cm-frontmatter');
    expect(front[0]).toHaveTextContent(/^---$/);
    expect(front[2]).toHaveTextContent(/^---$/);
    expect(element(container, '.cm-highlight')).toHaveTextContent(/^shine$/);
    expect(element(container, '.cm-md-comment')).toHaveTextContent('%%secret%%');
    expect(container.querySelector('.cm-content')).toHaveTextContent('Some bold and shine');
    expect(container.querySelector('.cm-wikilink')).not.toBeInTheDocument();
  });

  it('reveals the raw markdown on the active line and in source mode', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Markdown', body });
    const { container, view } = await mount({ noteId: note.id });
    const last = view.state.doc.lines;
    act(() => {
      view.focus();
      view.dispatch({ selection: { anchor: view.state.doc.line(last).from + 2 } });
    });
    await waitFor(() => {
      expect(element(container, '.cm-highlight')).toHaveTextContent('==shine==');
    });
    expect(container.querySelector('.cm-content')).toHaveTextContent('Some **bold**');

    act(() => {
      view.dispatch({ selection: { anchor: view.state.doc.line(16).from } });
    });
    await waitFor(() => {
      expect(container.querySelector('.cm-rule')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('radio', { name: 'Source' }));
    act(() => {
      view.contentDOM.blur();
    });
    await waitFor(() => {
      expect(element(container, '.cm-editor')).toHaveAttribute('data-mode', 'source');
    });
    await waitFor(() => {
      expect(container.querySelector('.cm-content')).toHaveTextContent('## Heading two');
    });
    expect(container.querySelector('.cm-rule')).not.toBeInTheDocument();
    expect(element(container, '.cm-highlight')).toHaveTextContent('==shine==');
  });
});

describe('note editor edge cases', () => {
  it('follows a link to a heading in the same note without adding history', async () => {
    const note = await createNote({ title: 'Self', body: '## Part\nJump to [[#Part]]' });
    const changes = vi.fn();
    const { container, view } = await mount({ noteId: note.id }, changes);
    const widget = await waitFor(() => element(container, '.cm-wikilink-note'));
    expect(widget).toHaveTextContent(/^Part$/);
    fireEvent.mouseDown(widget);
    await waitFor(() => {
      expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ noteId: note.id, anchor: 'Part' }));
    });
    expect(view.state.selection.main.head).toBe(0);
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
  });

  it('keeps the mode when the active mode is pressed again', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Sticky', body: '' });
    const changes = vi.fn();
    const { container } = await mount({ noteId: note.id }, changes);
    await user.click(screen.getByRole('radio', { name: 'Live preview' }));
    expect(changes).not.toHaveBeenCalled();
    expect(element(container, '.cm-editor')).toHaveAttribute('data-mode', 'live');
  });

  it('reports link updates when a renamed note has backlinks', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Core', body: '' });
    const fan = await createNote({ title: 'Fan', body: 'Loves [[Core]]' });
    await mount({ noteId: note.id });
    const title = screen.getByRole('textbox', { name: 'Note title' });
    await user.clear(title);
    await user.type(title, 'Heart');
    fireEvent.blur(title);
    expect(await screen.findByText('Updated links in 1 note')).toBeInTheDocument();
    expect(findNote(fan.id)?.body).toBe('Loves [[Heart]]');
  });

  it('extracts a selection and cancels a merge from the menu', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Big', body: 'Keep\nMove this' });
    await createNote({ title: 'Other', body: '' });
    const { container, view } = await mount({ noteId: note.id });

    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Extract selection to new note' }));
    expect(await screen.findByText('Select some text to extract first')).toBeInTheDocument();

    act(() => {
      view.dispatch({ selection: { anchor: 5, head: 14 } });
    });
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Extract selection to new note' }));
    await user.click(await screen.findByRole('button', { name: 'Extract' }));
    await waitFor(() => {
      expect(docOf(container)).toBe('Keep\n[[Move this]]');
    });
    expect(await screen.findByText('Moved the selection to Move this')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Merge into another note…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Merge Big' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(api.mergeNotes).not.toHaveBeenCalled();
  });

  it('imports pasted Markdown alone and ignores events without data', async () => {
    const note = await createNote({ title: 'Only notes', body: '' });
    const { container, view } = await mount({ noteId: note.id });
    fireEvent.drop(view.contentDOM);
    fireEvent.paste(view.contentDOM);
    fireEvent.paste(view.contentDOM, {
      clipboardData: { files: [file('Plan.md', 'text/markdown', 'Plan')] },
    });
    await waitFor(() => {
      expect(docOf(container)).toBe('[[Plan]]');
    });
    expect(api.importAssets).not.toHaveBeenCalled();
  });

  it('ignores pointer events on plain text and marks missing links in source mode', async () => {
    const note = await createNote({ title: 'Plain', body: '[[Ghost]] text' });
    const changes = vi.fn();
    const { container, view } = await mount({ noteId: note.id, mode: 'source' }, changes);
    const source = await waitFor(() => element(container, '.cm-wikilink-source'));
    expect(source).toHaveClass('cm-wikilink-missing');
    const text = source.firstChild;
    if (!text) throw new Error('No text');
    fireEvent.mouseOver(text);
    fireEvent.mouseDown(text, { ctrlKey: true });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(api.createNote).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Ghost' }));
    expect(changes).not.toHaveBeenCalled();
    expect(view.state.doc.toString()).toBe('[[Ghost]] text');
  });

  it('lets checkbox widgets receive their own events', async () => {
    const note = await createNote({ title: 'Boxes', body: 'Intro\n- [ ] One' });
    const { container, view } = await mount({ noteId: note.id });
    const box = await waitFor(() => element(container, 'input.cm-task'));
    fireEvent.mouseOver(box);
    expect(view.state.doc.line(2).text).toBe('- [ ] One');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

const data: CompletionData = {
  notes: [
    { title: 'Enemy AI', aliases: ['Robot'], headings: ['Behaviour', 'Stats'], blocks: ['b1'] },
    { title: 'Level one', aliases: [], headings: [], blocks: [] },
  ],
  items: {
    board: [{ name: 'World map', detail: '' }],
    palette: [{ name: 'Dusk', detail: '' }],
    asset: [{ name: 'hero.png', detail: 'image' }],
    ticket: [{ name: '1', detail: 'SG-1 Combat' }],
    card: [],
    table: [],
  },
  tags: ['enemy', 'design'],
  kindLabel: (kind) => `Kind ${kind}`,
  aliasLabel: 'Alias',
};

function completionView(doc: string, cursor = doc.length): EditorView {
  const parent = document.createElement('div');
  document.body.append(parent);
  return new EditorView({
    parent,
    state: EditorState.create({
      doc,
      selection: { anchor: cursor },
      extensions: [markdown({ base: markdownLanguage }), noteCompletion(() => data)],
    }),
  });
}

async function complete(
  doc: string,
  cursor = doc.length,
): Promise<{ view: EditorView; options: readonly Completion[] }> {
  const view = completionView(doc, cursor);
  startCompletion(view);
  const options = await waitFor(() => {
    const found = currentCompletions(view.state);
    expect(found.length).toBeGreaterThan(0);
    return found;
  });
  return { view, options };
}

function apply(view: EditorView, option: Completion | undefined, from: number) {
  if (!option || typeof option.apply !== 'function') throw new Error('No completion to apply');
  option.apply(view, option, from, view.state.selection.main.head);
}

describe('note completion', () => {
  it('offers notes, aliases and link kinds after [[', async () => {
    const { view, options } = await complete('See [[');
    expect(options.map((option) => option.label)).toEqual(
      expect.arrayContaining(['Enemy AI', 'Robot', 'Level one', 'board:', 'palette:', 'asset:', 'ticket:']),
    );
    const alias = options.find((option) => option.label === 'Robot');
    expect(alias?.detail).toBe('Alias · Enemy AI');
    expect(options.find((option) => option.label === 'ticket:')?.detail).toBe('Kind ticket');

    apply(view, alias, 6);
    expect(view.state.doc.toString()).toBe('See [[Enemy AI|Robot]]');
    expect(view.state.selection.main.head).toBe(view.state.doc.length);
    view.destroy();
  });

  it('inserts a link kind prefix', async () => {
    const { view, options } = await complete('[[');
    apply(
      view,
      options.find((option) => option.label === 'board:'),
      2,
    );
    expect(view.state.doc.toString()).toBe('[[board:');
    expect(view.state.selection.main.head).toBe(8);
    view.destroy();
  });

  it('replaces an existing closing bracket pair', async () => {
    const { view, options } = await complete('[[Lev]] after', 5);
    apply(
      view,
      options.find((option) => option.label === 'Level one'),
      2,
    );
    expect(view.state.doc.toString()).toBe('[[Level one]] after');
    view.destroy();
  });

  it('offers headings and blocks of a note found by title or alias', async () => {
    const headings = await complete('[[enemy ai#');
    expect(headings.options.map((option) => option.label)).toEqual(['enemy ai#Behaviour', 'enemy ai#Stats']);
    apply(headings.view, headings.options[1], 2);
    expect(headings.view.state.doc.toString()).toBe('[[enemy ai#Stats]]');
    headings.view.destroy();

    const blocks = await complete('[[Robot#^');
    expect(blocks.options.map((option) => option.label)).toEqual(['Robot#^b1']);
    expect(blocks.options[0]?.type).toBe('constant');
    blocks.view.destroy();
  });

  it('returns nothing useful for unknown notes or the current note', async () => {
    const unknown = completionView('[[Nobody#');
    startCompletion(unknown);
    const own = completionView('[[#');
    startCompletion(own);
    const ownBlock = completionView('[[#^');
    startCompletion(ownBlock);
    const plain = completionView('no link here');
    startCompletion(plain);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(currentCompletions(unknown.state)).toHaveLength(0);
    expect(currentCompletions(own.state)).toHaveLength(0);
    expect(currentCompletions(ownBlock.state)).toHaveLength(0);
    ownBlock.destroy();
    expect(currentCompletions(plain.state)).toHaveLength(0);
    unknown.destroy();
    own.destroy();
    plain.destroy();
  });

  it('offers Loopy items after a kind prefix', async () => {
    const { view, options } = await complete('[[Ticket:');
    expect(options.map((option) => option.label)).toEqual(['ticket:1']);
    expect(options[0]?.detail).toBe('SG-1 Combat');
    apply(view, options[0], 2);
    expect(view.state.doc.toString()).toBe('[[ticket:1]]');
    view.destroy();

    const boards = await complete('[[board:Wo');
    expect(boards.options.map((option) => option.label)).toEqual(['board:World map']);
    expect(boards.options[0]?.detail).toBeUndefined();
    boards.view.destroy();
  });

  it('completes tags but not a heading mark typed at the start of a line', async () => {
    const { view, options } = await complete('Some #');
    expect(options.map((option) => option.label).sort()).toEqual(['design', 'enemy']);
    expect(options[0]?.type).toBe('keyword');
    view.destroy();

    const explicit = await complete('#');
    expect(explicit.options).toHaveLength(2);
    explicit.view.destroy();

    const typed = completionView('');
    act(() => {
      typed.dispatch({
        changes: { from: 0, insert: '#' },
        selection: { anchor: 1 },
        userEvent: 'input.type',
      });
    });
    const midLine = completionView('Word ');
    act(() => {
      midLine.dispatch({
        changes: { from: 5, insert: '#' },
        selection: { anchor: 6 },
        userEvent: 'input.type',
      });
    });
    await waitFor(() => {
      expect(currentCompletions(midLine.state)).toHaveLength(2);
    });
    expect(currentCompletions(typed.state)).toHaveLength(0);
    typed.destroy();
    midLine.destroy();
  });
});
