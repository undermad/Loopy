import { useState, type ComponentType } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorView } from '@codemirror/view';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractTitle } from '@renderer/components/editors/Notes/ComposerDialogs';
import { NoteDetails } from '@renderer/components/editors/Notes/NoteDetails';
import { NoteEditor } from '@renderer/components/editors/Notes/NoteEditor';
import type { EditorProps } from '@renderer/lib/editors';
import { createNote, findNote, setActiveNote, updateNote } from '@renderer/lib/notes';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn((id: string, source: string) =>
    source.includes('broken')
      ? Promise.reject(new Error('Parse error'))
      : Promise.resolve({ svg: `<svg data-diagram="${id}"><text>${String(source.length)}</text></svg>` }),
  ),
}));

vi.mock('mermaid', () => ({ default: mermaid }));

let api: FakeApi;

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

describe('diagrams and maths', () => {
  it('draws Mermaid diagrams and KaTeX maths in the reading view', async () => {
    const note = await createNote({
      title: 'Flow',
      body: '```mermaid\ngraph TD; A-->B\n```\n\nEnergy is $E = mc^2$.\n\n$$\n\\sum_i x_i\n$$\n\n```mermaid\nbroken\n```',
    });
    const { container } = render(
      <Stateful editor={NoteEditor} initial={{ noteId: note.id, mode: 'reading' }} />,
    );
    await waitFor(() => {
      expect(container.querySelector('svg[data-diagram]')).toBeInTheDocument();
    });
    expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({ securityLevel: 'strict' }));
    expect(await screen.findByText(/This diagram could not be drawn: Parse error/)).toBeInTheDocument();
    expect(container.querySelector('figure pre')).toHaveTextContent('broken');
    expect(container.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('.katex-display')).toBeInTheDocument();
  });
});

describe('version history', () => {
  it('lists earlier versions, previews one and restores it', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Pitch', body: 'First draft' });
    await updateNote(note.id, { body: 'Second draft' });
    act(() => {
      setActiveNote(note.id);
    });
    render(<Stateful editor={NoteDetails} initial={{ tab: 'history' }} />);
    const list = await screen.findByRole('list', { name: 'History' });
    const version = within(list).getByRole('button', { pressed: false });
    expect(version).toHaveTextContent('2 words');
    await user.click(version);
    const preview = screen.getByRole('region', { name: 'Version preview' });
    expect(within(preview).getByText('First draft')).toBeInTheDocument();
    await user.click(within(preview).getByRole('button', { name: 'Restore this version' }));
    await waitFor(() => {
      expect(findNote(note.id)?.body).toBe('First draft');
    });
    expect(await screen.findByText('Version restored')).toBeInTheDocument();
  });

  it('explains when a note has no history yet', async () => {
    const note = await createNote({ title: 'Fresh' });
    act(() => {
      setActiveNote(note.id);
    });
    render(<Stateful editor={NoteDetails} initial={{ tab: 'history' }} />);
    expect(await screen.findByText(/No earlier versions yet/)).toBeInTheDocument();
  });
});

describe('note composer', () => {
  it('suggests a title from the first line of a selection', () => {
    expect(extractTitle('\n## Boss: phase one\nMore')).toBe('Boss phase one');
    expect(extractTitle('- item one')).toBe('item one');
  });

  it('extracts the selection into a new note and links it', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Design', body: 'Intro\n## Combat\nTwo hits.' });
    const { container } = render(<Stateful editor={NoteEditor} initial={{ noteId: note.id }} />);
    await waitFor(() => {
      expect(container.querySelector('.cm-content')).toHaveTextContent('Intro');
    });
    const host = container.querySelector('.cm-editor');
    const view = host instanceof HTMLElement ? EditorView.findFromDOM(host) : null;
    act(() => {
      view?.dispatch({ selection: { anchor: 6, head: 25 } });
    });
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Extract selection to new note' }));
    const title = await screen.findByLabelText(/New note title/);
    expect(title).toHaveValue('Combat');
    await user.click(screen.getByRole('button', { name: 'Extract' }));
    await waitFor(() => {
      expect(findNote(note.id)?.body).toBe('Intro\n[[Combat]]');
    });
    expect(api.notesData.notes.find((item) => item.title === 'Combat')?.body).toBe('## Combat\nTwo hits.');
  });

  it('asks for a selection before extracting', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Empty selection', body: 'Text' });
    render(<Stateful editor={NoteEditor} initial={{ noteId: note.id }} />);
    await user.click(await screen.findByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Extract selection to new note' }));
    expect(await screen.findByText('Select some text to extract first')).toBeInTheDocument();
  });

  it('merges the note into another and opens the target', async () => {
    const user = userEvent.setup();
    const target = await createNote({ title: 'Combat', body: '# Combat' });
    const source = await createNote({ title: 'Melee', body: 'Swords.' });
    await createNote({ title: 'Index', body: 'See [[Melee]]' });
    const changes = vi.fn();
    render(<Stateful editor={NoteEditor} initial={{ noteId: source.id }} onState={changes} />);
    await user.click(await screen.findByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Merge into another note…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Merge Melee' });
    expect(within(dialog).getByRole('combobox', { name: 'Merge into' })).toHaveTextContent('Combat');
    await user.click(within(dialog).getByRole('button', { name: 'Merge' }));
    await waitFor(() => {
      expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ noteId: target.id }));
    });
    expect(api.mergeNotes).toHaveBeenCalledWith(source.id, target.id);
    expect(findNote(target.id)?.body).toBe('# Combat\n\nSwords.\n');
    expect(api.notesData.notes.find((item) => item.title === 'Index')?.body).toBe('See [[Combat]]');
  });
});
