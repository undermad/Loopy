import { useState, type ComponentType, type ReactNode } from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LayoutNode } from '@shared/layout';
import type { Note } from '@shared/notes';
import { ExtractDialog, MergeDialog } from '@renderer/components/editors/Notes/ComposerDialogs';
import { MermaidBlock } from '@renderer/components/editors/Notes/MermaidBlock';
import { NoteDetails } from '@renderer/components/editors/Notes/NoteDetails';
import { NoteMarkdown, headingAnchor } from '@renderer/components/editors/Notes/NoteMarkdown';
import { NotesExplorer } from '@renderer/components/editors/Notes/NotesExplorer';
import {
  createFromTemplate,
  openDailyNote,
  templateBody,
  templateOptions,
} from '@renderer/components/editors/Notes/noteTemplates';
import { folderActions, importFiles } from '@renderer/lib/assets';
import { createBoard } from '@renderer/lib/board';
import type { EditorProps } from '@renderer/lib/editors';
import { useTranslation } from '@renderer/lib/i18n';
import {
  createNote,
  findNote,
  isoDay,
  resetNotesStore,
  setActiveNote,
  updateNote,
} from '@renderer/lib/notes';
import { createPalette } from '@renderer/lib/palettes';
import { ticketActions } from '@renderer/lib/tickets';
import { useWorkspaces } from '@renderer/lib/workspaces';
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

function areasOf(node: LayoutNode): { id: string; editor: string; state: Record<string, unknown> }[] {
  return node.kind === 'area' ? [node] : node.children.flatMap(areasOf);
}

function areaOf(editor: string) {
  const workspaces = renderHook(() => useWorkspaces()).result.current;
  return workspaces.flatMap((workspace) => areasOf(workspace.root)).find((area) => area.editor === editor);
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        {children}
      </ToastProvider>
    </TooltipProvider>
  );
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
    <Providers>
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
    </Providers>
  );
}

function file(name: string, type: string): File {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type });
}

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    left: x,
    top: y,
    width,
    height,
    right: x + width,
    bottom: y + height,
    toJSON: () => undefined,
  };
}

async function dragTo(row: HTMLElement, x: number, y: number) {
  for (const step of [0.5, 0.9, 1]) {
    await act(async () => {
      fireEvent.pointerMove(row, { clientX: x * step, clientY: y + (1 - step) * 60 });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  await act(async () => {
    fireEvent.pointerUp(row, { clientX: x, clientY: y });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function notesT() {
  return renderHook(() => useTranslation('notes')).result.current.t;
}

function noteNamed(title: string): Note {
  const note = api.notesData.notes.find((item) => item.title === title);
  if (!note) throw new Error(`No note ${title}`);
  return note;
}

function folderId(name: string): string {
  const folder = api.assetsData.snapshot.folders.find((item) => item.name === name);
  if (!folder) throw new Error(`No folder ${name}`);
  return folder.id;
}

function renderMarkdown(body: string, noteId: string | null = null, onToggleTask?: (line: number) => void) {
  const onLink = vi.fn();
  const onTag = vi.fn();
  const view = render(
    <NoteMarkdown
      body={body}
      noteId={noteId}
      onLink={onLink}
      onTag={onTag}
      {...(onToggleTask ? { onToggleTask } : {})}
    />,
  );
  return { ...view, onLink, onTag };
}

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.projects = [project];
  api.current = project;
  api.emitProject();
  await waitFor(() => {
    expect(api.listNotes).toHaveBeenCalled();
  });
});

describe('reading view basics', () => {
  it('explains an empty note at the top level only', () => {
    renderMarkdown('   ');
    expect(screen.getByText('This note is empty.')).toBeInTheDocument();
    const { container } = render(<NoteMarkdown body="" depth={1} onLink={vi.fn()} onTag={vi.fn()} />);
    expect(container.textContent).toBe('');
  });

  it('hides frontmatter, comments and block ids and anchors headings', () => {
    const { container } = renderMarkdown(
      '---\nsecret: hidden value\n---\n# Big Title!\n## Sub *part*\n### Third\n\nVisible text ^block-1\n\n%%\na hidden remark\n%%',
    );
    expect(container).not.toHaveTextContent('hidden value');
    expect(container).not.toHaveTextContent('hidden remark');
    expect(container).not.toHaveTextContent('block-1');
    expect(container.querySelector('h1')).toHaveAttribute('id', 'big-title');
    expect(container.querySelector('h2')).toHaveAttribute('id', 'sub-part');
    expect(container.querySelector('h3')).toHaveAttribute('id', 'third');
    expect(headingAnchor('Hello World')).toBe('hello-world');
  });

  it('hides one-line comments but keeps percent signs in code', () => {
    const { container } = renderMarkdown('Visible %%a hidden remark%% text and `%%kept%%`');
    expect(container).toHaveTextContent('Visible text and %%kept%%');
    expect(container).not.toHaveTextContent('hidden remark');
  });

  it('opens external links in a new window and keeps plain code blocks', () => {
    const { container } = renderMarkdown(
      '[Site](https://example.com)\n\n```\nplain code\n```\n\n```js\nlet x;\n```',
    );
    const link = screen.getByRole('link', { name: 'Site' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(container.querySelectorAll('pre')).toHaveLength(2);
    expect(container).toHaveTextContent('plain code');
  });

  it('toggles tasks only from the checkbox itself', () => {
    const onToggle = vi.fn();
    const { container } = renderMarkdown('Intro\n\n- [ ] One\n- [x] Two', null, onToggle);
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes[1]).toBeChecked();
    const items = container.querySelectorAll('li');
    const first = items[0];
    if (!(first instanceof HTMLElement)) throw new Error('No item');
    fireEvent.click(first);
    expect(onToggle).not.toHaveBeenCalled();
    const second = boxes[1];
    if (!second) throw new Error('No box');
    fireEvent.click(second);
    expect(onToggle).toHaveBeenCalledWith(3);
  });

  it('ignores task clicks without a toggle handler', () => {
    renderMarkdown('- [ ] Alone');
    const box = screen.getByRole('checkbox');
    fireEvent.click(box);
    expect(box).not.toBeChecked();
  });

  it('turns tags into buttons and highlights marks', () => {
    const { onTag } = renderMarkdown('Fights (#enemy) and ==fast== moves');
    fireEvent.click(screen.getByRole('button', { name: '#enemy' }));
    expect(onTag).toHaveBeenCalledWith('enemy');
    expect(screen.getByText('fast').tagName).toBe('MARK');
  });
});

describe('reading view links', () => {
  it('labels self links, subpaths and missing notes', async () => {
    const self = await createNote({ title: 'Self', body: '# Heading' });
    await createNote({ title: 'Target', body: '## Sec' });
    const { onLink } = renderMarkdown('[[#Heading]] [[Target#Sec]] [[Missing]] [[Target|Alias]]', self.id);
    const selfLink = screen.getByRole('link', { name: 'Heading' });
    expect(selfLink).toHaveAttribute('title', 'Self');
    expect(screen.getByRole('link', { name: 'Target › Sec' })).toHaveAttribute('title', 'Target');
    expect(screen.getByRole('link', { name: 'Missing' })).toHaveAttribute(
      'title',
      'Missing does not exist yet. Click to create it.',
    );
    fireEvent.click(screen.getByRole('link', { name: 'Alias' }));
    expect(onLink).toHaveBeenCalledWith(
      { kind: 'note', target: 'Target', subpath: null, alias: 'Alias' },
      expect.anything(),
    );
    fireEvent.click(selfLink);
    expect(onLink).toHaveBeenLastCalledWith(
      { kind: 'note', target: '', subpath: 'Heading', alias: null },
      expect.anything(),
    );
  });

  it('leaves a self link unresolved without a current note', () => {
    renderMarkdown('[[#Top]]');
    expect(screen.getByRole('link', { name: 'Top' })).toHaveAttribute(
      'title',
      ' does not exist yet. Click to create it.',
    );
  });

  it('embeds note sections, missing notes and stops deep embeds', async () => {
    await createNote({ title: 'Enemy', body: 'Intro\n\n## Behaviour\nChases the player.' });
    const loop = await createNote({ title: 'Loop', body: 'Again ![[Loop]]' });
    const { onLink } = renderMarkdown('![[Enemy#Behaviour]]\n\n![[Nope]]\n\n![[Loop]]', loop.id);
    const embed = screen.getByRole('group', { name: 'Enemy' });
    expect(within(embed).getByText('Chases the player.')).toBeInTheDocument();
    fireEvent.click(within(embed).getByRole('button', { name: 'Enemy › Behaviour' }));
    expect(onLink).toHaveBeenCalledWith(
      { kind: 'note', target: 'Enemy', subpath: 'Behaviour', alias: null },
      expect.anything(),
    );
    expect(screen.getByText('Nope')).toBeInTheDocument();
    expect(screen.getByText('Embed too deep to show.')).toBeInTheDocument();
    expect(screen.getAllByRole('group', { name: 'Loop' })).toHaveLength(4);
  });

  it('embeds files, palettes, boards and tickets', async () => {
    await importFiles(
      [
        file('hero.png', 'image/png'),
        file('theme.mp3', 'audio/mpeg'),
        file('clip.mp4', 'video/mp4'),
        file('spec.pdf', 'application/pdf'),
      ],
      'auto',
    );
    await createPalette({
      name: 'Dusk',
      harmony: 'custom',
      baseIndex: 0,
      source: 'wheel',
      colours: [
        { name: '', hex: '#ff8800' },
        { name: '', hex: '#220044' },
      ],
    });
    await createBoard({ name: 'World' });
    await ticketActions.create({ title: 'Implement combat', stateId: 'todo' });
    await ticketActions.create({ title: 'Loose end' });
    const { container, onLink } = renderMarkdown(
      [
        '![[asset:hero.png]]',
        '![[asset:hero.png|Hero art]]',
        '![[asset:theme.mp3]]',
        '![[asset:clip.mp4]]',
        '![[asset:spec.pdf]]',
        '![[palette:Dusk]]',
        '![[board:World|Overworld]]',
        '![[ticket:1]]',
        '![[ticket:2]]',
        '![[ticket:99]]',
        '![[board:Ghost]]',
      ].join('\n\n'),
    );
    expect(screen.getByRole('img', { name: 'hero.png' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Hero art' })).toBeInTheDocument();
    expect(container.querySelector('audio')).toHaveAttribute('controls');
    expect(container.querySelector('video')).toHaveAttribute('controls');
    expect(screen.getByRole('button', { name: /^spec\.pdf/ })).toHaveTextContent('File');
    const palette = screen.getByRole('button', { name: /^Dusk/ });
    expect(palette).toHaveTextContent('Palette');
    expect(palette.querySelectorAll('span[style]')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /^Overworld/ })).toHaveTextContent('Board');
    expect(screen.getByRole('button', { name: /^SPA-1 Implement combat/ })).toHaveTextContent('To do');
    expect(screen.getByRole('button', { name: /^SPA-2 Loose end/ })).toHaveTextContent('Ticket');
    expect(screen.getByText('99')).toBeInTheDocument();
    expect(screen.getByText('Ghost')).toBeInTheDocument();
    fireEvent.click(palette);
    expect(onLink).toHaveBeenCalledWith(
      { kind: 'palette', target: 'Dusk', subpath: null, alias: null },
      expect.anything(),
    );
  });

  it('shows Loopy chips with colours and disables missing ones', async () => {
    await createPalette({
      name: 'Dawn',
      harmony: 'custom',
      baseIndex: 0,
      source: 'wheel',
      colours: [{ name: '', hex: '#ffeeaa' }],
    });
    await ticketActions.create({ title: 'Boss fight', stateId: 'doing' });
    const { onLink } = renderMarkdown(
      '[[palette:Dawn]] [[ticket:SPA-1]] [[board:Nowhere]] [[palette:Dawn|Morning]]',
    );
    const chip = screen.getByRole('button', { name: 'Dawn' });
    expect(chip.querySelectorAll('span')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'SPA-1 Boss fight' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Nowhere' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Morning' }));
    expect(onLink).toHaveBeenCalledWith(
      { kind: 'palette', target: 'Dawn', subpath: null, alias: 'Morning' },
      expect.anything(),
    );
  });
});

describe('reading view callouts', () => {
  it('renders every callout shape', () => {
    const { container } = renderMarkdown(
      [
        '> [!tip] Try this',
        '> Use the dash.',
        '',
        '> [!danger]',
        '> Lava below.',
        '',
        '> [!custom-kind] Odd',
        '',
        '> [!faq]- Folded',
        '> Hidden answer',
        '',
        '> [!note]+ Opened',
        '> Shown answer',
        '',
        '> Plain quote',
        '',
        '> **Bold** quote',
        '',
        '> - listed',
      ].join('\n'),
    );
    expect(container.querySelector('aside[data-callout="tip"]')).toHaveTextContent(
      /Try this\s*Use the dash\./,
    );
    expect(container.querySelector('aside[data-callout="danger"]')).toHaveTextContent(
      /Danger\s*Lava below\./,
    );
    expect(container.querySelector('aside[data-callout="custom-kind"]')).toHaveTextContent('Odd');
    const folded = container.querySelector('details[data-callout="faq"]');
    expect(folded).not.toHaveAttribute('open');
    expect(folded).toHaveTextContent('Folded');
    expect(container.querySelector('details[data-callout="note"]')).toHaveAttribute('open');
    expect(container.querySelectorAll('blockquote')).toHaveLength(3);
  });
});

describe('reading view queries', () => {
  it('shows a sorted table of matches with property columns', async () => {
    const host = await createNote({ title: 'Host', body: '#unit' });
    await createNote({
      title: 'Alpha',
      body: '---\nrank: 2\nperks:\n  - fast\n  - loud\nempty:\n---\n#unit',
    });
    await createNote({ title: 'Beta', body: '---\nrank: 10\n---\n#unit' });
    const { container, onLink } = renderMarkdown(
      '```query\ntag:#unit\ntable: rank, perks, empty, title, updated, created\nsort: rank desc\n```',
      host.id,
    );
    const rows = [...container.querySelectorAll('tbody tr')];
    expect(rows.map((row) => row.querySelector('td')?.textContent)).toEqual(['Beta', 'Alpha']);
    expect(rows[1]).toHaveTextContent('fast, loud');
    expect(rows[1]).toHaveTextContent('2026-10-17T09:00:00.000Z');
    expect(screen.getByRole('columnheader', { name: 'Note' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Beta' }));
    expect(onLink).toHaveBeenCalledWith(
      { kind: 'note', target: 'Beta', subpath: null, alias: null },
      expect.anything(),
    );
  });

  it('sorts a list ascending and opens a result', async () => {
    await createNote({ title: 'Zed', body: 'boss notes' });
    await createNote({ title: 'Ann', body: 'boss notes' });
    const { onLink } = renderMarkdown('```query\nboss\nsort: title\n```');
    const list = screen.getByRole('list', { name: 'Query results' });
    expect(
      within(list)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Ann', 'Zed']);
    fireEvent.click(within(list).getByRole('link', { name: 'Zed' }));
    expect(onLink).toHaveBeenCalledWith(
      { kind: 'note', target: 'Zed', subpath: null, alias: null },
      expect.anything(),
    );
  });

  it('says when a query has no matches', () => {
    renderMarkdown('```query\ntag:#nothing\n```');
    expect(screen.getByText('No notes match this query.')).toBeInTheDocument();
  });
});

describe('mermaid diagrams', () => {
  it('uses the dark theme when the app is dark', async () => {
    api = await bootTestApp({}, 'dark');
    const { container } = render(<MermaidBlock source="graph TD; A-->B" />);
    await waitFor(() => {
      expect(container.querySelector('svg[data-diagram]')).toBeInTheDocument();
    });
    expect(mermaid.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'dark' }));
  });

  it('reports failures that are not errors', async () => {
    const shape = { name: 'Plain', message: 'ignored', toString: () => 'plain failure' };
    const reason: Error = shape;
    mermaid.render.mockImplementationOnce(() => Promise.reject(reason));
    render(<MermaidBlock source="graph LR; X-->Y" />);
    expect(await screen.findByText('This diagram could not be drawn: plain failure')).toBeInTheDocument();
    expect(screen.getByText('graph LR; X-->Y')).toBeInTheDocument();
  });

  it('drops a result that arrives after unmounting', async () => {
    let finish: (value: { svg: string }) => void = () => undefined;
    mermaid.render.mockImplementationOnce(
      () =>
        new Promise<{ svg: string }>((resolve) => {
          finish = resolve;
        }),
    );
    const { unmount } = render(<MermaidBlock source="graph TD; late" />);
    await waitFor(() => {
      expect(mermaid.render).toHaveBeenCalledWith(expect.any(String), 'graph TD; late');
    });
    unmount();
    await act(async () => {
      finish({ svg: '<svg data-late="1"></svg>' });
      await Promise.resolve();
    });
    expect(document.querySelector('svg[data-late]')).toBeNull();
  });
});

describe('note templates', () => {
  it('lists built-in and user templates and fills their bodies', async () => {
    const t = notesT();
    await folderActions.create({ name: 'Templates', parentId: null, scope: 'notes' });
    const template = await createNote({
      title: 'Quest',
      folderId: folderId('Templates'),
      body: '# {{title}} on {{ date }}',
    });
    const options = templateOptions(t, api.notesData.notes, api.assetsData.snapshot.folders);
    expect(options.map((option) => option.key)).toContain(`note:${template.id}`);
    expect(options[0]).toMatchObject({ key: 'builtIn:blank', label: 'Blank note' });
    const now = new Date(2026, 9, 18, 9, 5);
    expect(templateBody(t, { kind: 'builtIn', id: 'blank' }, 'X', now)).toBe('');
    expect(templateBody(t, { kind: 'builtIn', id: 'meeting' }, 'Weekly sync', now)).toContain(
      '**Date:** 2026-10-18 09:05',
    );
    expect(templateBody(t, { kind: 'note', note: template }, 'Rescue', now)).toBe('# Rescue on 2026-10-18');
  });

  it('creates notes from templates with fallback and wanted titles', async () => {
    const t = notesT();
    const blank = await createFromTemplate(t, { kind: 'builtIn', id: 'blank' }, null);
    expect(blank).toMatchObject({ title: 'Untitled', body: '' });
    const enemy = await createFromTemplate(t, { kind: 'builtIn', id: 'enemy' }, null);
    expect(enemy.title).toBe('Enemy');
    expect(enemy.body).toContain('# Enemy');
    const named = await createFromTemplate(t, { kind: 'builtIn', id: 'enemy' }, null, 'Slime');
    expect(named.title).toBe('Slime');
    const again = await createFromTemplate(t, { kind: 'builtIn', id: 'blank' }, null);
    expect(again.title).not.toBe('Untitled');
  });

  it('opens an existing daily note or creates one in the daily folder', async () => {
    const t = notesT();
    const now = new Date(2026, 9, 18, 8, 0);
    const existing = await createNote({ title: '2026-10-18' });
    const found = await openDailyNote(t, api.notesData.notes, api.assetsData.snapshot.folders, now);
    expect(found.id).toBe(existing.id);

    await folderActions.create({ name: 'DAILY', parentId: null, scope: 'notes' });
    const fresh = await openDailyNote(
      t,
      api.notesData.notes,
      api.assetsData.snapshot.folders,
      new Date(2026, 9, 19, 8, 0),
    );
    expect(fresh).toMatchObject({ title: '2026-10-19', folderId: folderId('DAILY') });
    expect(fresh.body).toContain('type: daily');
  });

  it('uses a custom daily template from the templates folder', async () => {
    const t = notesT();
    await folderActions.create({ name: 'Templates', parentId: null, scope: 'notes' });
    await createNote({ title: 'Daily note', folderId: folderId('Templates'), body: 'Plan for {{date}}' });
    const note = await openDailyNote(
      t,
      api.notesData.notes,
      api.assetsData.snapshot.folders,
      new Date(2026, 0, 2, 7, 0),
    );
    expect(note).toMatchObject({ title: '2026-01-02', folderId: null, body: 'Plan for 2026-01-02' });
  });
});

describe('note details panel', () => {
  it('shows an empty state without an active note', () => {
    render(<Stateful editor={NoteDetails} />);
    expect(screen.getByText('Open a note to see its details')).toBeInTheDocument();
  });

  it('lists outgoing links and opens each kind', async () => {
    const user = userEvent.setup();
    const board = await createBoard({ name: 'World' });
    const target = await createNote({ title: 'Target', body: '## Sec' });
    const note = await createNote({
      title: 'Hub',
      body: '# Hub\n[[Target]] [[Ghost]] [[board:World]] [[#Hub]] [[Target#Sec]]',
    });
    await createNote({ title: 'Fan', body: 'Loves [[Hub]]' });
    await createNote({ title: 'Lurker', body: 'Mentions Hub in passing' });
    act(() => {
      setActiveNote(note.id);
    });
    render(<Stateful editor={NoteDetails} />);
    const outgoing = screen.getByRole('region', { name: 'Outgoing links' });
    expect(within(outgoing).getByRole('button', { name: 'Ghost' })).toHaveAttribute(
      'title',
      'Not created yet',
    );
    expect(within(outgoing).getByRole('button', { name: 'Target' })).not.toHaveAttribute('title');
    expect(within(outgoing).getByRole('button', { name: '#Hub' })).not.toHaveAttribute('title');

    await user.click(within(outgoing).getByRole('button', { name: 'Target#Sec' }));
    expect(areaOf('note')?.state).toMatchObject({ noteId: target.id, anchor: 'Sec' });
    await user.click(within(outgoing).getByRole('button', { name: 'board:World' }));
    expect(areaOf('board')?.state['boardId']).toBe(board.id);
    await user.click(within(outgoing).getByRole('button', { name: 'Ghost' }));
    await waitFor(() => {
      expect(api.notesData.notes.map((item) => item.title)).toContain('Ghost');
    });

    await user.click(
      within(screen.getByRole('region', { name: 'Backlinks' })).getByRole('button', { name: 'Fan' }),
    );
    expect(areaOf('note')?.state['noteId']).toBe(noteNamed('Fan').id);
    await user.click(
      within(screen.getByRole('region', { name: 'Unlinked mentions' })).getByRole('button', {
        name: 'Lurker',
      }),
    );
    expect(areaOf('note')?.state['noteId']).toBe(noteNamed('Lurker').id);
  });

  it('links a mention with an alias when the case differs', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Combat' });
    const mention = await createNote({ title: 'Lore', body: 'The combat system.' });
    act(() => {
      setActiveNote(note.id);
    });
    render(<Stateful editor={NoteDetails} />);
    expect(screen.getByText('No backlinks')).toBeInTheDocument();
    expect(screen.getByText('No outgoing links')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Turn into a link' }));
    expect(findNote(mention.id)?.body).toBe('The [[Combat|combat]] system.');
  });

  it('shows tags in the outline and opens them', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Plain', body: 'No headings but #lore here' });
    act(() => {
      setActiveNote(note.id);
    });
    render(<Stateful editor={NoteDetails} initial={{ tab: 'outline' }} />);
    expect(screen.getByText('No headings')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '#lore' }));
    expect(areaOf('notes')?.state['search']).toBe('tag:#lore');
  });

  it('parses edited property values by type', async () => {
    const user = userEvent.setup();
    const note = await createNote({
      title: 'Stats',
      body: '---\nperks:\n  - fast\nflag: true\ncount: 3\nname: Bob\nlabel: x\n---\nBody',
    });
    act(() => {
      setActiveNote(note.id);
    });
    render(<Stateful editor={NoteDetails} initial={{ tab: 'properties' }} />);

    const edit = async (name: string, value: string) => {
      const input = screen.getByRole('textbox', { name });
      await user.clear(input);
      if (value) await user.type(input, value);
      fireEvent.blur(input);
    };

    await edit('perks', 'quick, quiet');
    expect(findNote(note.id)?.body).toContain('perks:\n  - quick\n  - quiet');
    await edit('flag', 'false');
    expect(findNote(note.id)?.body).toContain('flag: false');
    await edit('count', '');
    expect(findNote(note.id)?.body).toMatch(/count:\n/);
    await edit('name', '-1.5');
    expect(findNote(note.id)?.body).toContain('name: -1.5');
    await edit('label', 'a, b');
    expect(findNote(note.id)?.body).toContain('label:\n  - a\n  - b');
    const before = findNote(note.id)?.body;
    await edit('flag', 'false');
    expect(findNote(note.id)?.body).toBe(before);

    const key = screen.getByRole('textbox', { name: 'Property name' });
    await user.type(key, 'flag{Enter}');
    expect(findNote(note.id)?.body).toBe(before);
    await user.clear(key);
    await user.type(key, '   {Enter}');
    expect(findNote(note.id)?.body).toBe(before);
    await user.clear(key);
    await user.type(key, 'my key{Enter}');
    expect(findNote(note.id)?.body).toContain('my-key:');
    expect(key).toHaveValue('');
  });

  it('shows a note without properties', async () => {
    const note = await createNote({ title: 'Bare', body: 'Nothing' });
    act(() => {
      setActiveNote(note.id);
    });
    render(<Stateful editor={NoteDetails} initial={{ tab: 'properties' }} />);
    expect(screen.getByText('No properties')).toBeInTheDocument();
  });

  it('toggles a version preview and labels renamed versions', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Draft', body: 'One' });
    await updateNote(note.id, { body: 'Two' });
    await updateNote(note.id, { title: 'Final' });
    act(() => {
      setActiveNote(note.id);
    });
    render(<Stateful editor={NoteDetails} initial={{ tab: 'history' }} />);
    const list = await screen.findByRole('list', { name: 'History' });
    const version = within(list).getByRole('button');
    expect(version).toHaveTextContent('Draft · 1 word');
    await user.click(version);
    expect(screen.getByRole('region', { name: 'Version preview' })).toBeInTheDocument();
    expect(version).toHaveAttribute('aria-pressed', 'true');
    await user.click(version);
    expect(screen.queryByRole('region', { name: 'Version preview' })).not.toBeInTheDocument();
    await user.click(version);
    const preview = screen.getByRole('region', { name: 'Version preview' });
    await user.click(within(preview).getByRole('button', { name: 'Restore this version' }));
    await waitFor(() => {
      expect(findNote(note.id)?.body).toBe('One');
    });
    expect(await screen.findByText('Version restored')).toBeInTheDocument();
  });

  it('ignores versions that arrive after closing', async () => {
    const note = await createNote({ title: 'Quick', body: 'One' });
    act(() => {
      setActiveNote(note.id);
    });
    const { unmount } = render(<Stateful editor={NoteDetails} initial={{ tab: 'history' }} />);
    unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(api.listNoteVersions).toHaveBeenCalledWith(note.id);
  });

  it('switches tabs, jumps to headings, removes properties and keeps text values', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Doc', body: '---\nmood: calm\nold: 1\n---\n# Doc\n## Part' });
    act(() => {
      setActiveNote(note.id);
    });
    const changes = vi.fn();
    render(<Stateful editor={NoteDetails} onState={changes} />);
    await user.click(screen.getByRole('tab', { name: 'Outline' }));
    expect(changes).toHaveBeenLastCalledWith({ tab: 'outline' });
    await user.click(screen.getByRole('button', { name: 'Part' }));
    expect(areaOf('note')?.state).toMatchObject({ noteId: note.id, anchor: 'Part' });
    await user.click(screen.getByRole('tab', { name: 'Properties' }));
    const mood = screen.getByRole('textbox', { name: 'mood' });
    await user.clear(mood);
    await user.type(mood, 'stormy');
    fireEvent.blur(mood);
    expect(findNote(note.id)?.body).toContain('mood: stormy');
    await user.click(screen.getByRole('button', { name: 'Remove old' }));
    expect(findNote(note.id)?.body).not.toContain('old:');
  });

  it('links an exact mention without an alias', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Combat' });
    const mention = await createNote({ title: 'Lore', body: 'Combat is old.' });
    act(() => {
      setActiveNote(note.id);
    });
    render(<Stateful editor={NoteDetails} />);
    await user.click(screen.getByRole('button', { name: 'Turn into a link' }));
    expect(findNote(mention.id)?.body).toBe('[[Combat]] is old.');
  });
});

describe('composer dialogs', () => {
  it('merges into the chosen note', async () => {
    const user = userEvent.setup();
    const source = await createNote({ title: 'Melee', body: 'Swords.' });
    await createNote({ title: 'Archery', body: 'Bows.' });
    const target = await createNote({ title: 'Combat', body: '# Combat' });
    const onMerged = vi.fn();
    render(
      <Providers>
        <MergeDialog note={source} onClose={vi.fn()} onMerged={onMerged} />
      </Providers>,
    );
    const select = screen.getByRole('combobox', { name: 'Merge into' });
    expect(select).toHaveTextContent('Archery');
    await user.click(select);
    await user.click(await screen.findByRole('option', { name: 'Combat' }));
    await user.click(screen.getByRole('button', { name: 'Merge' }));
    await waitFor(() => {
      expect(onMerged).toHaveBeenCalledWith(target.id);
    });
    expect(api.mergeNotes).toHaveBeenCalledWith(source.id, target.id);
  });

  it('suggests Untitled for a blank selection and closes on cancel', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Source' });
    const onClose = vi.fn();
    render(
      <Providers>
        <ExtractDialog note={note} text={'   \n  '} onClose={onClose} onExtracted={vi.fn()} />
      </Providers>,
    );
    expect(await screen.findByLabelText(/New note title/)).toHaveValue('Untitled');
    expect(screen.getByRole('button', { name: 'Extract' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('explains when there is nothing to merge into', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Only' });
    const onClose = vi.fn();
    render(
      <Providers>
        <MergeDialog note={note} onClose={onClose} onMerged={vi.fn()} />
      </Providers>,
    );
    expect(screen.getByText('There is no other note to merge into.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Merge' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('extracts text into a note in the same folder and closes on cancel', async () => {
    const user = userEvent.setup();
    await folderActions.create({ name: 'Lore', parentId: null, scope: 'notes' });
    const note = await createNote({ title: 'Source', folderId: folderId('Lore') });
    const onClose = vi.fn();
    const onExtracted = vi.fn();
    render(
      <Providers>
        <ExtractDialog
          note={note}
          text={'# Ancient war\nDetails'}
          onClose={onClose}
          onExtracted={onExtracted}
        />
      </Providers>,
    );
    expect(await screen.findByLabelText(/New note title/)).toHaveValue('Ancient war');
    await user.click(screen.getByRole('button', { name: 'Extract' }));
    await waitFor(() => {
      expect(onExtracted).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Ancient war', folderId: folderId('Lore') }),
      );
    });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('notes explorer tree', () => {
  async function seedTree() {
    await folderActions.create({ name: 'World', parentId: null, scope: 'notes' });
    await folderActions.create({ name: 'Caves', parentId: folderId('World'), scope: 'notes' });
    await folderActions.create({ name: 'Empty', parentId: null, scope: 'notes' });
    await createNote({ title: 'Map', folderId: folderId('World') });
    await createNote({ title: 'Bats', folderId: folderId('Caves') });
    await createNote({ title: 'Loose' });
  }

  it('shows a spinner until notes load', () => {
    resetNotesStore();
    render(<Stateful editor={NotesExplorer} />);
    expect(screen.queryByRole('searchbox', { name: 'Search notes' })).not.toBeInTheDocument();
  });

  it('renders nested folders and collapses them', async () => {
    const user = userEvent.setup();
    await act(seedTree);
    render(<Stateful editor={NotesExplorer} initial={{ sort: 'updated' }} />);
    const world = screen.getByRole('button', { name: /^World/ });
    expect(world).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /^Caves/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bats' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Files/ })).toHaveTextContent('3');
    await user.click(world);
    expect(world).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /^Caves/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Map' })).not.toBeInTheDocument();
    await user.click(world);
    expect(screen.getByRole('button', { name: 'Map' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Files/ }));
    expect(screen.getByRole('button', { name: 'Loose' })).toBeInTheDocument();
  });

  it('runs the note context menu actions', async () => {
    const user = userEvent.setup();
    await act(seedTree);
    render(<Stateful editor={NotesExplorer} />);
    const menuFor = async (title: string, item: string) => {
      fireEvent.contextMenu(screen.getByRole('button', { name: title }));
      await user.click(await screen.findByRole('menuitem', { name: item }));
    };

    await menuFor('Loose', 'Open');
    expect(areaOf('note')?.state['noteId']).toBe(noteNamed('Loose').id);

    await menuFor('Loose', 'Bookmark');
    await waitFor(() => {
      expect(noteNamed('Loose').starred).toBe(true);
    });
    expect(await screen.findByText('Bookmarks')).toBeInTheDocument();
    const [row] = screen.getAllByRole('button', { name: 'Loose' });
    if (!row) throw new Error('No row');
    fireEvent.contextMenu(row);
    await user.click(await screen.findByRole('menuitem', { name: 'Remove bookmark' }));
    await waitFor(() => {
      expect(noteNamed('Loose').starred).toBe(false);
    });

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Loose' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move to' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'World/Caves' }));
    await waitFor(() => {
      expect(noteNamed('Loose').folderId).toBe(folderId('Caves'));
    });
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Loose' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move to' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Top level' }));
    await waitFor(() => {
      expect(noteNamed('Loose').folderId).toBeNull();
    });

    await menuFor('Loose', 'Export');
    expect(api.exportNotes).toHaveBeenCalledWith({ ids: [noteNamed('Loose').id], loopyLinks: 'keep' });
    expect(await screen.findByText('Notes exported')).toBeInTheDocument();

    await menuFor('Loose', 'Rename');
    const input = screen.getByRole('textbox', { name: 'Loose' });
    await user.clear(input);
    await user.type(input, 'Map{Enter}');
    expect(await screen.findByText('A note called Map already exists')).toBeInTheDocument();

    const loose = noteNamed('Loose');
    await menuFor('Loose', 'Delete');
    const dialog = await screen.findByRole('dialog', { name: 'Delete 1 note?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(findNote(loose.id)).toBeNull();
    });
  });

  it('keeps titles on escape or no change and reports updated links', async () => {
    const user = userEvent.setup();
    await act(async () => {
      await createNote({ title: 'Quest' });
      await createNote({ title: 'Index', body: 'See [[Quest]]' });
    });
    render(<Stateful editor={NotesExplorer} />);
    const row = screen.getByRole('button', { name: 'Quest' });
    row.focus();
    await user.keyboard('{F2}');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Quest' })).toBeInTheDocument();

    await user.dblClick(screen.getByRole('button', { name: 'Quest' }));
    fireEvent.blur(screen.getByRole('textbox', { name: 'Quest' }));
    expect(api.updateNote).not.toHaveBeenCalled();

    await user.dblClick(screen.getByRole('button', { name: 'Quest' }));
    const input = screen.getByRole('textbox', { name: 'Quest' });
    await user.clear(input);
    await user.type(input, 'Main quest{Enter}');
    expect(await screen.findByText('Updated links in 1 note')).toBeInTheDocument();
    expect(noteNamed('Index').body).toBe('See [[Main quest]]');
  });

  it('runs the folder context menu actions', async () => {
    const user = userEvent.setup();
    await act(seedTree);
    render(<Stateful editor={NotesExplorer} />);
    const menuFor = async (folder: RegExp, item: string) => {
      fireEvent.contextMenu(screen.getByRole('button', { name: folder }));
      await user.click(await screen.findByRole('menuitem', { name: item }));
    };

    await menuFor(/^World/, 'Export folder');
    const [folderExport] = vi.mocked(api.exportNotes).mock.lastCall ?? [];
    expect(folderExport?.ids.toSorted()).toEqual([noteNamed('Map').id, noteNamed('Bats').id].toSorted());
    expect(folderExport?.loopyLinks).toBe('keep');
    await menuFor(/^Empty/, 'Export folder');
    expect(api.exportNotes).toHaveBeenCalledTimes(1);

    vi.mocked(api.pickNotes).mockImplementationOnce(() =>
      Promise.resolve({
        status: 'imported' as const,
        notes: api.notesData.notes,
        ids: ['x', 'y'],
      }),
    );
    await menuFor(/^World/, 'Markdown files…');
    expect(api.pickNotes).toHaveBeenCalledWith('files', folderId('World'));
    expect(await screen.findByText('Imported 2 notes')).toBeInTheDocument();

    await menuFor(/^World/, 'New note');
    await waitFor(() => {
      expect(noteNamed('Untitled').folderId).toBe(folderId('World'));
    });
    expect(screen.getByRole('textbox', { name: 'Untitled' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Untitled' }), { key: 'Escape' });

    await menuFor(/^World/, 'New folder');
    const create = await screen.findByRole('dialog', { name: 'New folder' });
    await user.type(within(create).getByRole('textbox'), 'Peaks');
    await user.click(within(create).getByRole('button', { name: 'New folder' }));
    await waitFor(() => {
      expect(api.assetsData.snapshot.folders.find((item) => item.name === 'Peaks')?.parentId).toBe(
        folderId('World'),
      );
    });

    await menuFor(/^Empty/, 'Rename');
    const rename = await screen.findByRole('dialog', { name: 'Rename' });
    const field = within(rename).getByRole('textbox');
    expect(field).toHaveValue('Empty');
    await user.clear(field);
    await user.type(field, 'Spare');
    await user.click(within(rename).getByRole('button', { name: 'Rename' }));
    expect(await screen.findByRole('button', { name: /^Spare/ })).toBeInTheDocument();

    await menuFor(/^Spare/, 'Delete folder');
    const confirm = await screen.findByRole('dialog', { name: 'Delete folder Spare?' });
    expect(confirm).toHaveTextContent('Notes inside move up one level.');
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(api.assetsData.snapshot.folders.some((item) => item.name === 'Spare')).toBe(false);
    });
    expect(api.deleteAssetFolder).toHaveBeenCalled();
  });

  it('runs the root folder menu', async () => {
    const user = userEvent.setup();
    await act(seedTree);
    render(<Stateful editor={NotesExplorer} />);
    fireEvent.contextMenu(screen.getByRole('button', { name: /^Files/ }));
    expect(screen.queryByRole('menuitem', { name: 'Delete folder' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('menuitem', { name: 'Export all notes' }));
    const [allExport] = vi.mocked(api.exportNotes).mock.lastCall ?? [];
    expect(allExport?.ids.toSorted()).toEqual(api.notesData.notes.map((note) => note.id).toSorted());
    fireEvent.contextMenu(screen.getByRole('button', { name: /^Files/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'New folder' }));
    const create = await screen.findByRole('dialog', { name: 'New folder' });
    await user.type(within(create).getByRole('textbox'), 'Top');
    await user.click(within(create).getByRole('button', { name: 'New folder' }));
    await waitFor(() => {
      expect(api.assetsData.snapshot.folders.find((item) => item.name === 'Top')?.parentId).toBeNull();
    });
  });
});

describe('notes explorer toolbar', () => {
  it('creates notes from built-in and user templates', async () => {
    const user = userEvent.setup();
    await act(async () => {
      await folderActions.create({ name: 'Templates', parentId: null, scope: 'notes' });
      await createNote({ title: 'Boss', folderId: folderId('Templates'), body: '# {{title}} boss' });
    });
    render(<Stateful editor={NotesExplorer} />);
    await user.click(screen.getByRole('button', { name: 'New from template' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Enemy' }));
    await waitFor(() => {
      expect(api.notesData.notes.map((note) => note.title)).toContain('Enemy');
    });
    expect(noteNamed('Enemy').body).toContain('# Enemy');

    await user.click(screen.getByRole('button', { name: 'New from template' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Boss' }));
    await waitFor(() => {
      expect(api.notesData.notes.find((note) => note.body === '# Untitled boss')).toBeDefined();
    });
  });

  it('imports, exports and changes the sort order', async () => {
    const user = userEvent.setup();
    const changes = vi.fn();
    await act(async () => {
      await createNote({ title: 'Alpha' });
    });
    render(<Stateful editor={NotesExplorer} onState={changes} />);
    await user.click(screen.getByRole('button', { name: 'Import' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Markdown files…' }));
    expect(api.pickNotes).toHaveBeenLastCalledWith('files', null);
    await user.click(screen.getByRole('button', { name: 'Import' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Folder or Obsidian vault…' }));
    expect(api.pickNotes).toHaveBeenLastCalledWith('folder', null);

    vi.mocked(api.exportNotes).mockImplementationOnce(() =>
      Promise.resolve({ status: 'cancelled' as const }),
    );
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Export all notes' }));
    expect(api.exportNotes).toHaveBeenCalledWith({ ids: [noteNamed('Alpha').id], loopyLinks: 'keep' });
    expect(screen.queryByText('Notes exported')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'By last edit' }));
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'updated' }));
  });

  it('opens today’s note, creating it once in the daily folder', async () => {
    const user = userEvent.setup();
    await act(async () => {
      await folderActions.create({ name: 'Daily', parentId: null, scope: 'notes' });
    });
    render(<Stateful editor={NotesExplorer} />);
    const today = isoDay(new Date());
    await user.click(screen.getByRole('button', { name: "Open today's note" }));
    await waitFor(() => {
      expect(noteNamed(today).folderId).toBe(folderId('Daily'));
    });
    expect(areaOf('note')?.state['noteId']).toBe(noteNamed(today).id);
    await user.click(screen.getByRole('button', { name: "Open today's note" }));
    await waitFor(() => {
      expect(api.createNote).toHaveBeenCalledTimes(1);
    });
    expect(api.notesData.notes.filter((note) => note.title === today)).toHaveLength(1);
  });

  it('shows when a search finds nothing', async () => {
    await act(async () => {
      await createNote({ title: 'Alpha' });
    });
    render(<Stateful editor={NotesExplorer} initial={{ search: 'zzz' }} />);
    expect(screen.getByText('No notes match')).toBeInTheDocument();
  });
});

describe('notes explorer drops', () => {
  it('imports dropped Markdown files and ignores other files', async () => {
    render(<Stateful editor={NotesExplorer} />);
    const explorer = screen.getByLabelText('Notes');
    const markdown = { name: 'Lore.md', text: () => Promise.resolve('# Lore') };
    const image = { name: 'hero.png', text: () => Promise.resolve('') };
    const over = fireEvent.dragOver(explorer, { dataTransfer: { files: [], types: ['Files'] } });
    expect(over).toBe(false);
    expect(fireEvent.dragOver(explorer, { dataTransfer: { files: [], types: ['text/plain'] } })).toBe(true);
    expect(fireEvent.drop(explorer, { dataTransfer: { files: [image], types: ['Files'] } })).toBe(true);
    expect(api.importNotes).not.toHaveBeenCalled();
    fireEvent.drop(explorer, { dataTransfer: { files: [markdown, image], types: ['Files'] } });
    expect(await screen.findByText('Imported 1 note')).toBeInTheDocument();
    expect(api.importNotes).toHaveBeenCalledWith({
      files: [{ path: 'Lore.md', body: '# Lore' }],
      folderId: null,
    });
  });

  it('moves a dragged note onto a folder', async () => {
    await act(async () => {
      await folderActions.create({ name: 'World', parentId: null, scope: 'notes' });
      await createNote({ title: 'Wanderer' });
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.hasAttribute('data-note') || this.textContent === 'Wanderer') return rect(0, 200, 200, 20);
      if (this.hasAttribute('aria-expanded')) {
        return this.textContent.startsWith('World') ? rect(0, 100, 200, 20) : rect(0, 0, 200, 20);
      }
      return rect(0, 0, 0, 0);
    });
    render(<Stateful editor={NotesExplorer} />);
    const row = screen.getByRole('button', { name: 'Wanderer' });
    fireEvent.pointerDown(row, { button: 0, isPrimary: true, clientX: 10, clientY: 210 });
    await dragTo(row, 10, 110);
    await waitFor(() => {
      expect(noteNamed('Wanderer').folderId).toBe(folderId('World'));
    });
  });

  it('hands a dragged note to a drop zone under the pointer', async () => {
    await act(async () => {
      await createNote({ title: 'Wanderer' });
    });
    const zone = document.createElement('div');
    zone.setAttribute('data-asset-drop', '');
    document.body.append(zone);
    const received = vi.fn();
    zone.addEventListener('loopy:asset-drag', (event) => {
      if (event instanceof CustomEvent) received(event.detail);
    });
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([zone]);
    render(<Stateful editor={NotesExplorer} />);
    const row = screen.getByRole('button', { name: 'Wanderer' });
    fireEvent.pointerDown(row, { button: 0, isPrimary: true, clientX: 10, clientY: 10 });
    await dragTo(row, 40, 40);
    await waitFor(() => {
      expect(received).toHaveBeenCalledWith(expect.objectContaining({ phase: 'drop' }));
    });
    expect(received).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'move', links: [{ kind: 'note', id: noteNamed('Wanderer').id }] }),
    );
    expect(api.updateNote).not.toHaveBeenCalled();
    zone.remove();
  });
});

describe('notes explorer extras', () => {
  it('moves dragged notes to the top level, ignores same-folder and empty drops and cancels', async () => {
    await act(async () => {
      await folderActions.create({ name: 'World', parentId: null, scope: 'notes' });
      await createNote({ title: 'Wanderer', folderId: folderId('World') });
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.hasAttribute('data-note') || this.textContent === 'Wanderer') return rect(0, 200, 200, 20);
      if (this.hasAttribute('aria-expanded')) {
        return this.textContent.startsWith('World') ? rect(0, 100, 200, 20) : rect(0, 0, 200, 20);
      }
      return rect(0, 0, 0, 0);
    });
    render(<Stateful editor={NotesExplorer} />);
    const grab = () => {
      const row = screen.getByRole('button', { name: 'Wanderer' });
      fireEvent.pointerDown(row, { button: 0, isPrimary: true, clientX: 10, clientY: 210 });
      return row;
    };
    await dragTo(grab(), 10, 10);
    await waitFor(() => {
      expect(noteNamed('Wanderer').folderId).toBeNull();
    });
    const calls = vi.mocked(api.updateNote).mock.calls.length;
    await dragTo(grab(), 10, 10);
    await dragTo(grab(), 10, 5000);
    expect(api.updateNote).toHaveBeenCalledTimes(calls);

    const row = grab();
    await act(async () => {
      fireEvent.pointerMove(row, { clientX: 10, clientY: 150 });
      fireEvent.pointerMove(row, { clientX: 10, clientY: 140 });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getAllByText('Wanderer')).toHaveLength(2);
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => {
      expect(screen.getAllByText('Wanderer')).toHaveLength(1);
    });
    expect(api.updateNote).toHaveBeenCalledTimes(calls);
  });

  it('cancels folder prompts and delete confirmations', async () => {
    const user = userEvent.setup();
    await act(async () => {
      await createNote({ title: 'Keep' });
    });
    render(<Stateful editor={NotesExplorer} />);
    await user.click(screen.getByRole('button', { name: 'New folder' }));
    const prompt = await screen.findByRole('dialog', { name: 'New folder' });
    await user.click(within(prompt).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Keep' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete 1 note?' });
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.deleteNotes).not.toHaveBeenCalled();
  });

  it('orders equal tags by name, marks the active hit and renames without links', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Zeta', body: '#beta #alpha' });
    act(() => {
      setActiveNote(note.id);
    });
    render(<Stateful editor={NotesExplorer} />);
    const tagNames = screen
      .getAllByRole('button', { name: /^(alpha|beta)/ })
      .map((button) => button.textContent);
    expect(tagNames).toEqual(['alpha1', 'beta1']);

    const row = screen.getByRole('button', { name: 'Zeta' });
    row.focus();
    await user.keyboard('a');
    expect(screen.queryByRole('textbox', { name: 'Zeta' })).not.toBeInTheDocument();
    await user.dblClick(row);
    const input = screen.getByRole('textbox', { name: 'Zeta' });
    await user.clear(input);
    await user.type(input, 'Omega{Enter}');
    await waitFor(() => {
      expect(findNote(note.id)?.title).toBe('Omega');
    });
    expect(screen.queryByText(/Updated links/)).not.toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Search notes' }), 'Omega');
    const hit = await screen.findByRole('listitem');
    expect(hit.className).toMatch(/active/);
    await user.click(hit);
    expect(areaOf('note')?.state['noteId']).toBe(note.id);

    await user.clear(screen.getByRole('searchbox', { name: 'Search notes' }));
    await user.click(screen.getByRole('button', { name: /^alpha/ }));
    expect(screen.getByRole('searchbox', { name: 'Search notes' })).toHaveValue('tag:#alpha');
    await user.clear(screen.getByRole('searchbox', { name: 'Search notes' }));
    await user.click(screen.getByRole('button', { name: 'New note' }));
    await waitFor(() => {
      expect(api.notesData.notes.map((item) => item.title)).toContain('Untitled');
    });
    expect(areaOf('note')?.state['noteId']).toBe(noteNamed('Untitled').id);
  });

  it('skips the toast when dropped Markdown imports nothing', async () => {
    vi.mocked(api.importNotes).mockImplementationOnce(() =>
      Promise.resolve({ status: 'cancelled' as const }),
    );
    render(<Stateful editor={NotesExplorer} />);
    const explorer = screen.getByLabelText('Notes');
    fireEvent.drop(explorer, {
      dataTransfer: {
        files: [{ name: 'Empty.markdown', text: () => Promise.resolve('') }],
        types: ['Files'],
      },
    });
    await waitFor(() => {
      expect(api.importNotes).toHaveBeenCalled();
    });
    expect(screen.queryByText(/Imported/)).not.toBeInTheDocument();
  });
});

describe('reading view extras', () => {
  it('splits marks, tags and block ids at the start of text', () => {
    const { container } = renderMarkdown(
      '==hi== there\n\n#start of line\n\n**bold** ^abc\n\n#\n\n[[#Gone]]',
      'missing-id',
    );
    expect(screen.getByText('hi').tagName).toBe('MARK');
    expect(screen.getByRole('button', { name: '#start' })).toBeInTheDocument();
    expect(container).not.toHaveTextContent('abc');
    expect(container.querySelector('h1')).toHaveAttribute('id', '');
    expect(screen.getByRole('link', { name: 'Gone' })).toHaveAttribute(
      'title',
      ' does not exist yet. Click to create it.',
    );
  });

  it('draws diagrams inside the reading view', async () => {
    const { container } = renderMarkdown('```mermaid\ngraph TD; A-->B\n```');
    await waitFor(() => {
      expect(container.querySelector('svg[data-diagram]')).toBeInTheDocument();
    });
    expect(screen.getByRole('figure', { name: 'Diagram' })).toBeInTheDocument();
  });

  it('lists query hits without repeating the title', async () => {
    await createNote({ title: 'Rogue', body: '---\nclass: rogue\n---\nSneaky' });
    renderMarkdown('```query\n[class:rogue]\n```');
    const list = screen.getByRole('list', { name: 'Query results' });
    expect(within(list).getByRole('link', { name: 'Rogue' })).toBeInTheDocument();
  });
});
