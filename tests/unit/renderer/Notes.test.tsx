import { useState, type ComponentType } from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LayoutNode } from '@shared/layout';
import { AssetLinkCard } from '@renderer/components/AssetLinkCard/AssetLinkCard';
import { AssetsEditor } from '@renderer/components/editors/Assets/AssetsEditor';
import { TicketEditor } from '@renderer/components/editors/Tickets/TicketEditor';
import { AreaContext } from '@renderer/components/Shell/AreaContext';
import { GraphView } from '@renderer/components/editors/Notes/GraphView';
import { NoteDetails } from '@renderer/components/editors/Notes/NoteDetails';
import { NoteEditor } from '@renderer/components/editors/Notes/NoteEditor';
import { NotesExplorer } from '@renderer/components/editors/Notes/NotesExplorer';
import { QuickSwitcher } from '@renderer/components/editors/Notes/QuickSwitcher';
import type { EditorProps } from '@renderer/lib/editors';
import { createBoard } from '@renderer/lib/board';
import { createNote, findNote, setActiveNote, updateNote } from '@renderer/lib/notes';
import { selectTicket, ticketActions } from '@renderer/lib/tickets';
import { linkTarget, useWorkspaces } from '@renderer/lib/workspaces';
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
  onState?: (state: Record<string, unknown>) => void;
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

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
  await waitFor(() => {
    expect(api.listNotes).toHaveBeenCalled();
  });
});

describe('notes as internal assets', () => {
  it('opens a note link in the Idea Map workspace', () => {
    expect(
      linkTarget(
        { kind: 'note', id: 'n1' },
        { planning: 'Planning', design: 'Design', palette: 'Palette', assets: 'Assets', ideas: 'Idea Map' },
      ),
    ).toEqual({ editor: 'note', state: { noteId: 'n1' }, template: 'ideas', workspaceName: 'Idea Map' });
  });

  it('shows a note link card with its title and first line', async () => {
    const note = await createNote({
      title: 'Boss fight',
      body: '# Boss fight\n\nThree phases with [[Arena|an arena]].',
    });
    const onOpen = vi.fn();
    render(<AssetLinkCard link={{ kind: 'note', id: note.id }} onOpen={onOpen} />);
    const card = screen.getByRole('button', { name: /Boss fight/ });
    expect(card).toHaveTextContent('Three phases with an arena.');
    fireEvent.click(card);
    expect(onOpen).toHaveBeenCalledWith({ kind: 'note', id: note.id });
  });
});

describe('notes explorer', () => {
  it('creates notes, searches them and filters by tag', async () => {
    const user = userEvent.setup();
    render(<Stateful editor={NotesExplorer} initial={{ search: '' }} />);
    expect(await screen.findByText('No notes yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New note' }));
    await waitFor(() => {
      expect(api.notesData.notes).toHaveLength(1);
    });
    expect(areaOf('note')?.state['noteId']).toBe(api.notesData.notes[0]?.id);

    await act(async () => {
      await createNote({ title: 'Enemy AI', body: 'Patrols #enemy' });
      await createNote({ title: 'Level one', body: 'Has [[Enemy AI]]' });
    });
    await user.click(await screen.findByRole('button', { name: /^enemy/ }));
    const search = screen.getByRole('searchbox', { name: 'Search notes' });
    expect(search).toHaveValue('tag:#enemy');
    expect(await screen.findByText('1 result')).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'enemy');
    expect(await screen.findByText('2 results')).toBeInTheDocument();
    await user.click(screen.getByText('Level one'));
    expect(areaOf('note')?.state['noteId']).toBe(
      api.notesData.notes.find((note) => note.title === 'Level one')?.id,
    );
  });

  it('lists bookmarked notes and renames a note inline', async () => {
    const user = userEvent.setup();
    await act(async () => {
      const note = await createNote({ title: 'Pitch' });
      await updateNote(note.id, { starred: true });
    });
    render(<Stateful editor={NotesExplorer} initial={{ search: '' }} />);
    expect(await screen.findByText('Bookmarks')).toBeInTheDocument();
    const [row, pinned] = screen.getAllByRole('button', { name: /^Pitch/ });
    expect(pinned).toBeDefined();
    if (!row) throw new Error('No row');
    await user.dblClick(row);
    const input = screen.getByRole('textbox', { name: 'Pitch' });
    await user.clear(input);
    await user.type(input, 'Elevator pitch{Enter}');
    await waitFor(() => {
      expect(api.notesData.notes[0]?.title).toBe('Elevator pitch');
    });
  });
});

describe('note editor', () => {
  it('renders the reading view with links, embeds, callouts, queries and tasks', async () => {
    const user = userEvent.setup();
    const board = await createBoard({ name: 'World map' });
    const enemy = await createNote({
      title: 'Enemy AI',
      body: 'Intro\n\n## Behaviour\nChases the player. #enemy',
    });
    const level = await createNote({
      title: 'Level one',
      body: [
        '---',
        'status: draft',
        '---',
        '> [!warning] Hard',
        '> Watch out',
        '',
        'Meet [[Enemy AI|the robot]] on [[board:World map]] near [[Missing note]] ==fast==.',
        '',
        '![[Enemy AI#Behaviour]]',
        '',
        '- [ ] Blockout',
        '',
        '```query',
        'tag:#enemy',
        '```',
      ].join('\n'),
    });
    const changes = vi.fn();
    const { container } = render(
      <Stateful editor={NoteEditor} initial={{ noteId: level.id, mode: 'reading' }} onState={changes} />,
    );

    await waitFor(() => {
      expect(container.querySelector('aside[data-callout="warning"]')).toHaveTextContent(/Hard\s*Watch out/);
    });
    expect(screen.getByText('fast').tagName).toBe('MARK');
    const embed = screen.getByRole('group', { name: 'Enemy AI' });
    expect(within(embed).getByText(/Chases the player/)).toBeInTheDocument();
    const results = screen.getByRole('list', { name: 'Query results' });
    expect(within(results).getByText('Enemy AI')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'World map' }));
    expect(areaOf('board')?.state['boardId']).toBe(board.id);

    await user.click(screen.getByRole('checkbox'));
    await waitFor(() => {
      expect(findNote(level.id)?.body).toContain('- [x] Blockout');
    });

    await user.click(screen.getByRole('link', { name: 'the robot' }));
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ noteId: enemy.id }));
  });

  it('creates a missing note from a link and renames notes with link updates', async () => {
    const user = userEvent.setup();
    const source = await createNote({ title: 'Hub', body: 'Go to [[Side quest]]' });
    const changes = vi.fn();
    render(
      <Stateful editor={NoteEditor} initial={{ noteId: source.id, mode: 'reading' }} onState={changes} />,
    );
    await user.click(await screen.findByRole('link', { name: 'Side quest' }));
    await waitFor(() => {
      expect(api.notesData.notes.map((note) => note.title)).toContain('Side quest');
    });
    const created = api.notesData.notes.find((note) => note.title === 'Side quest');
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ noteId: created?.id }));

    const title = await screen.findByRole('textbox', { name: 'Note title' });
    await waitFor(() => {
      expect(title).toHaveValue('Side quest');
    });
    await user.clear(title);
    await user.type(title, 'Bonus quest');
    fireEvent.blur(title);
    expect(await screen.findByText('Updated links in 1 note')).toBeInTheDocument();
    expect(findNote(source.id)?.body).toBe('Go to [[Bonus quest]]');

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ noteId: source.id }));
  });

  it('edits in live preview and shows link widgets and counts', async () => {
    await createNote({ title: 'Target', body: 'x' });
    const note = await createNote({ title: 'Writer', body: 'Link to [[Target]] here' });
    const { container } = render(<Stateful editor={NoteEditor} initial={{ noteId: note.id }} />);
    await waitFor(() => {
      expect(container.querySelector('.cm-content')).toHaveTextContent('Link to Target here');
    });
    expect(container.querySelector('.cm-wikilink')).toHaveTextContent('Target');
    expect(screen.getByText('4 words')).toBeInTheDocument();
    expect(screen.getByText('0 backlinks')).toBeInTheDocument();
  });

  it('shows an empty state that creates a note', async () => {
    const user = userEvent.setup();
    const changes = vi.fn();
    render(<Stateful editor={NoteEditor} onState={changes} />);
    await user.click(screen.getByRole('button', { name: 'New note' }));
    await waitFor(() => {
      expect(changes).toHaveBeenCalledWith(expect.objectContaining({ noteId: api.notesData.notes[0]?.id }));
    });
  });
});

describe('note details', () => {
  it('lists backlinks, links unlinked mentions and edits properties', async () => {
    const user = userEvent.setup();
    const target = await createNote({ title: 'Combat', body: '---\nhp: 10\n---\n# Combat\n## Melee' });
    const linked = await createNote({ title: 'Stamina', body: 'Used in [[Combat]].' });
    const mention = await createNote({ title: 'Lore', body: 'Combat is ancient.' });
    act(() => {
      setActiveNote(target.id);
    });
    render(<Stateful editor={NoteDetails} initial={{ tab: 'links' }} />);

    const backlinks = screen.getByRole('region', { name: 'Backlinks' });
    expect(within(backlinks).getByText('Stamina')).toBeInTheDocument();
    expect(within(backlinks).getByText('Used in [[Combat]].')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Turn into a link' }));
    expect(findNote(mention.id)?.body).toBe('[[Combat]] is ancient.');
    expect(findNote(linked.id)?.body).toBe('Used in [[Combat]].');

    await user.click(screen.getByRole('tab', { name: 'Outline' }));
    await user.click(screen.getByRole('button', { name: 'Melee' }));
    expect(areaOf('note')?.state).toMatchObject({ noteId: target.id, anchor: 'Melee' });

    await user.click(screen.getByRole('tab', { name: 'Properties' }));
    const hp = screen.getByRole('textbox', { name: 'hp' });
    await user.clear(hp);
    await user.type(hp, '25');
    fireEvent.blur(hp);
    expect(findNote(target.id)?.body).toContain('hp: 25');
    await user.type(screen.getByRole('textbox', { name: 'Property name' }), 'status{Enter}');
    expect(findNote(target.id)?.body).toContain('status:');
    await user.click(screen.getByRole('button', { name: 'Remove hp' }));
    expect(findNote(target.id)?.body).not.toContain('hp:');
  });
});

describe('quick switcher and graph', () => {
  it('opens an existing note', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Inventory' });
    const onOpenChange = vi.fn();
    render(
      <TooltipProvider>
        <QuickSwitcher open onOpenChange={onOpenChange} />
      </TooltipProvider>,
    );
    await user.type(screen.getByRole('combobox', { name: 'Find or create a note' }), 'inv{Enter}');
    expect(areaOf('note')?.state['noteId']).toBe(note.id);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('creates a note from the switcher with Shift and Enter', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <QuickSwitcher open onOpenChange={() => undefined} />
      </TooltipProvider>,
    );
    await user.type(
      screen.getByRole('combobox', { name: 'Find or create a note' }),
      'Crafting{Shift>}{Enter}{/Shift}',
    );
    await waitFor(() => {
      expect(api.notesData.notes.map((note) => note.title)).toEqual(['Crafting']);
    });
  });

  it('lists graph nodes and opens a note from the graph', async () => {
    const user = userEvent.setup();
    const target = await createNote({ title: 'Combat' });
    await createNote({ title: 'Stamina', body: '[[Combat]]' });
    render(<Stateful editor={GraphView} initial={{ scope: 'global' }} />);
    const list = screen.getByRole('list', { name: 'Graph' });
    expect(
      within(list)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Combat', 'Stamina']);
    await user.click(within(list).getByRole('button', { name: 'Combat' }));
    expect(areaOf('note')?.state['noteId']).toBe(target.id);

    await user.click(screen.getByRole('radio', { name: 'Current note' }));
    expect(screen.getByText('Open a note to see its links')).toBeInTheDocument();
  });
});

describe('notes in other editors', () => {
  it('lists notes as internal assets and opens them from the Assets editor', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Design pillars' });
    function Assets() {
      const [slot, setSlot] = useState<HTMLElement | null>(null);
      return (
        <>
          <div ref={setSlot} />
          <AreaContext value={{ areaId: 'a', headerSlot: slot }}>
            <Stateful editor={AssetsEditor} initial={{ scope: 'notes' }} />
          </AreaContext>
        </>
      );
    }
    render(<Assets />);
    const notesTree = screen.getByRole('tree', { name: 'Notes' });
    expect(within(notesTree).getByRole('treeitem', { name: /Notes/ })).toBeInTheDocument();
    const card = screen.getByRole('button', { name: 'Design pillars' });
    expect(card).toHaveAttribute('data-internal', 'note');
    await user.dblClick(card);
    await waitFor(() => {
      expect(areaOf('note')?.state['noteId']).toBe(note.id);
    });
  });

  it('links a note to a ticket and opens it from the chip', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Combat rules', body: 'Two hits per combo.' });
    await ticketActions.create({ title: 'Implement combat', stateId: 'todo' });
    selectTicket('ticket-1');
    render(<Stateful editor={TicketEditor} />);
    const section = screen.getByRole('region', { name: 'Linked assets' });
    await user.click(within(section).getByRole('button', { name: 'Link asset' }));
    await user.click(
      within(screen.getByRole('group', { name: 'Notes' })).getByRole('switch', { name: 'Combat rules' }),
    );
    await user.keyboard('{Escape}');
    expect(api.updateTicket).toHaveBeenLastCalledWith('ticket-1', { links: [{ kind: 'note', id: note.id }] });
    const list = within(section).getByRole('list', { name: 'Linked assets' });
    const chip = within(list).getByRole('button', { name: /^Combat rules/ });
    expect(chip).toHaveTextContent('Two hits per combo.');
    fireEvent.click(chip);
    expect(areaOf('note')?.state['noteId']).toBe(note.id);
  });
});
