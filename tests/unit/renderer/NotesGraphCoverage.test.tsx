import { useState, type ComponentType } from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assetUrl } from '@shared/assets';
import type { LayoutNode } from '@shared/layout';
import type { LinkParts } from '@shared/markdown';
import { GraphView } from '@renderer/components/editors/Notes/GraphView';
import { HoverPreview } from '@renderer/components/editors/Notes/HoverPreview';
import { QuickSwitcher } from '@renderer/components/editors/Notes/QuickSwitcher';
import { useLoopyItems } from '@renderer/components/editors/Notes/useLoopyItems';
import { importFiles } from '@renderer/lib/assets';
import { createBoard, resetBoardStore } from '@renderer/lib/board';
import type { EditorProps } from '@renderer/lib/editors';
import { createNote, setActiveNote } from '@renderer/lib/notes';
import { createPalette, resetPalettesStore } from '@renderer/lib/palettes';
import { resetProjectStore } from '@renderer/lib/project';
import { ticketActions, useSelectedTicketId } from '@renderer/lib/tickets';
import { useWorkspaces } from '@renderer/lib/workspaces';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

interface Op {
  name: string;
  args: (string | number)[];
  fillStyle: string;
  strokeStyle: string;
  globalAlpha: number;
}

class FakeContext {
  fillStyle = '';
  strokeStyle = '';
  globalAlpha = 1;
  lineWidth = 1;
  font = '';
  textAlign = 'start';
  ops: Op[] = [];

  private log(name: string, args: (string | number)[]) {
    this.ops.push({
      name,
      args,
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      globalAlpha: this.globalAlpha,
    });
  }

  setTransform(...args: number[]) {
    this.log('setTransform', args);
  }
  clearRect(...args: number[]) {
    this.log('clearRect', args);
  }
  translate(...args: number[]) {
    this.log('translate', args);
  }
  scale(...args: number[]) {
    this.log('scale', args);
  }
  beginPath() {
    this.log('beginPath', []);
  }
  moveTo(...args: number[]) {
    this.log('moveTo', args);
  }
  lineTo(...args: number[]) {
    this.log('lineTo', args);
  }
  stroke() {
    this.log('stroke', []);
  }
  arc(...args: number[]) {
    this.log('arc', args);
  }
  fill() {
    this.log('fill', []);
  }
  fillText(text: string, x: number, y: number) {
    this.log('fillText', [text, x, y]);
  }

  frame(): Op[] {
    const start = this.ops.map((op) => op.name).lastIndexOf('clearRect');
    return start < 0 ? [] : this.ops.slice(start);
  }

  labels(): string[] {
    return this.frame()
      .filter((op) => op.name === 'fillText')
      .map((op) => String(op.args[0]));
  }

  view(): { tx: number; ty: number; k: number } {
    const frame = this.frame();
    const translate = frame.find((op) => op.name === 'translate');
    const scale = frame.find((op) => op.name === 'scale');
    return {
      tx: Number(translate?.args[0] ?? 0),
      ty: Number(translate?.args[1] ?? 0),
      k: Number(scale?.args[0] ?? 1),
    };
  }

  point(label: string): { x: number; y: number } | null {
    const frame = this.frame();
    const at = frame.findIndex((op) => op.name === 'fillText' && op.args[0] === label);
    if (at < 0) return null;
    const arc = frame
      .slice(0, at)
      .reverse()
      .find((op) => op.name === 'arc');
    if (!arc) return null;
    const { tx, ty, k } = this.view();
    return { x: tx + Number(arc.args[0]) * k, y: ty + Number(arc.args[1]) * k };
  }
}

let context: FakeContext;
let observed: number;

class SizedResizeObserver {
  constructor(private callback: ResizeObserverCallback) {}
  observe() {
    observed += 1;
    this.callback([], this);
    this.callback([{ contentRect: { width: 400, height: 300 } } as ResizeObserverEntry], this);
  }
  unobserve() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
}

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

function file(name: string, type: string): File {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type });
}

function rect(left: number, top: number, width = 60, height = 16): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => undefined,
  };
}

function graphList() {
  return screen.getByRole('list', { name: 'Graph' });
}

function canvasElement() {
  return screen.getByRole('img', { name: 'Note graph. Click a node to open it.' });
}

async function pointOf(label: string) {
  let found: { x: number; y: number } | null = null;
  await waitFor(() => {
    found = context.point(label);
    expect(found).not.toBeNull();
  });
  const point = context.point(label);
  if (!point) throw new Error(`No node drawn for ${label}`);
  return point;
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
  context = new FakeContext();
  observed = 0;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context as never);
  vi.stubGlobal('ResizeObserver', SizedResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('graph view canvas', () => {
  it('sizes the canvas from the stage and draws linked notes with labels', async () => {
    await createNote({ title: 'Combat' });
    await createNote({ title: 'Stamina', body: '[[Combat]]' });
    render(<Stateful editor={GraphView} />);
    const canvas = canvasElement();
    expect(observed).toBe(1);
    expect(canvas).toHaveStyle({ width: '400px', height: '300px' });
    await waitFor(() => {
      expect(context.labels().sort()).toEqual(['Combat', 'Stamina']);
    });
    expect(canvas).toHaveAttribute('width', '400');
    expect(canvas).toHaveAttribute('height', '300');
    expect(context.view()).toEqual({ tx: 200, ty: 150, k: 1 });
    expect(context.frame().some((op) => op.name === 'lineTo' && op.strokeStyle === '#ccc')).toBe(true);
  });

  it('opens a note when its node is clicked without moving', async () => {
    const target = await createNote({ title: 'Combat' });
    render(<Stateful editor={GraphView} />);
    const canvas = canvasElement();
    const point = await pointOf('Combat');
    fireEvent.pointerDown(canvas, { clientX: point.x, clientY: point.y, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: point.x + 1, clientY: point.y + 1, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: point.x + 1, clientY: point.y + 1, pointerId: 1 });
    expect(areaOf('note')?.state['noteId']).toBe(target.id);
  });

  it('drags a node to a new place without opening it', async () => {
    const target = await createNote({ title: 'Combat' });
    await createNote({ title: 'Stamina', body: '[[Combat]]' });
    render(<Stateful editor={GraphView} />);
    const canvas = canvasElement();
    const point = await pointOf('Combat');
    fireEvent.pointerDown(canvas, { clientX: point.x, clientY: point.y, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 320, clientY: 60, pointerId: 1 });
    await waitFor(() => {
      expect(context.point('Combat')).toEqual({ x: 320, y: 60 });
    });
    fireEvent.pointerUp(canvas, { clientX: 320, clientY: 60, pointerId: 1 });
    expect(areaOf('note')?.state['noteId']).not.toBe(target.id);
  });

  it('pans the view by dragging empty space and resets it', async () => {
    const user = userEvent.setup();
    await createNote({ title: 'Combat' });
    render(<Stateful editor={GraphView} />);
    const canvas = canvasElement();
    await pointOf('Combat');
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    fireEvent.pointerDown(canvas, { clientX: 2, clientY: 2, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 52, clientY: 22, pointerId: 1 });
    expect(context.view()).toEqual({ tx: 250, ty: 170, k: 1 });
    fireEvent.pointerUp(canvas, { clientX: 52, clientY: 22, pointerId: 1 });
    expect(areaOf('note')?.state['noteId']).toBeUndefined();

    await user.click(screen.getByRole('button', { name: 'Reset view' }));
    expect(context.view()).toEqual({ tx: 200, ty: 150, k: 1 });
  });

  it('zooms with the wheel and hides labels when zoomed far out', async () => {
    await createNote({ title: 'Combat' });
    render(<Stateful editor={GraphView} />);
    const canvas = canvasElement();
    await pointOf('Combat');
    fireEvent.wheel(canvas, { clientX: 200, clientY: 150, deltaY: -100 });
    expect(context.view().k).toBeCloseTo(Math.exp(0.15));
    expect(context.view().tx).toBeCloseTo(200);
    fireEvent.wheel(canvas, { clientX: 100, clientY: 100, deltaY: 5000 });
    expect(context.view().k).toBeCloseTo(0.15);
    expect(context.labels()).toEqual([]);
  });

  it('highlights a hovered node and its links, then clears on leave', async () => {
    await createNote({ title: 'Combat' });
    await createNote({ title: 'Stamina', body: '[[Combat]]' });
    await createNote({ title: 'Lore' });
    render(<Stateful editor={GraphView} />);
    const canvas = canvasElement();
    const point = await pointOf('Combat');
    fireEvent.pointerMove(canvas, { clientX: point.x, clientY: point.y });
    expect(canvas.style.cursor).toBe('pointer');
    const lit = context.frame();
    expect(lit.some((op) => op.name === 'stroke' && op.strokeStyle === '#4f46e5')).toBe(true);
    expect(lit.some((op) => op.name === 'fill' && op.globalAlpha === 0.25)).toBe(true);

    const count = context.ops.length;
    fireEvent.pointerMove(canvas, { clientX: point.x, clientY: point.y });
    expect(context.ops.length).toBe(count);

    fireEvent.pointerLeave(canvas);
    expect(context.frame().some((op) => op.name === 'stroke' && op.strokeStyle === '#4f46e5')).toBe(false);
    const after = context.ops.length;
    fireEvent.pointerLeave(canvas);
    expect(context.ops.length).toBe(after);

    fireEvent.pointerMove(canvas, { clientX: point.x, clientY: point.y });
    fireEvent.pointerMove(canvas, { clientX: 1, clientY: 1 });
    expect(canvas.style.cursor).toBe('grab');

    const stamina = context.point('Stamina');
    if (!stamina) throw new Error('Stamina not drawn');
    fireEvent.pointerMove(canvas, { clientX: stamina.x, clientY: stamina.y });
    expect(context.frame().some((op) => op.name === 'stroke' && op.strokeStyle === '#4f46e5')).toBe(true);

    fireEvent.pointerMove(canvas, { clientX: 1, clientY: 1 });
    const lore = context.point('Lore');
    if (!lore) throw new Error('Lore not drawn');
    fireEvent.pointerMove(canvas, { clientX: lore.x, clientY: lore.y });
    const dimmed = context.frame();
    expect(dimmed.some((op) => op.name === 'stroke' && op.strokeStyle === '#4f46e5')).toBe(false);
    expect(dimmed.some((op) => op.name === 'stroke' && op.globalAlpha === 0.25)).toBe(true);
    expect(dimmed.some((op) => op.name === 'fillText' && op.globalAlpha === 0.2)).toBe(true);
  });

  it('marks the active note and hides labels when they are switched off', async () => {
    const note = await createNote({ title: 'Combat' });
    act(() => {
      setActiveNote(note.id);
    });
    render(<Stateful editor={GraphView} initial={{ labels: false }} />);
    await waitFor(() => {
      expect(context.frame().some((op) => op.name === 'fill' && op.fillStyle === '#4f46e5')).toBe(true);
    });
    expect(context.labels()).toEqual([]);
  });

  it('lists nodes without drawing when the canvas has no 2D context', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await createNote({ title: 'Combat' });
    render(<Stateful editor={GraphView} />);
    expect(within(graphList()).getByRole('button', { name: 'Combat' })).toBeInTheDocument();
    fireEvent.wheel(canvasElement(), { clientX: 200, clientY: 150, deltaY: -100 });
    expect(context.ops).toEqual([]);
  });

  it('falls back to a pixel ratio of one', async () => {
    vi.stubGlobal('devicePixelRatio', 0);
    await createNote({ title: 'Combat' });
    render(<Stateful editor={GraphView} />);
    await pointOf('Combat');
    expect(context.frame()[0]?.name).toBe('clearRect');
    expect(context.ops.find((op) => op.name === 'setTransform')?.args).toEqual([1, 0, 0, 1, 0, 0]);
  });
});

describe('graph view nodes and settings', () => {
  it('ignores invalid saved settings and shows the empty state', () => {
    render(
      <Stateful
        editor={GraphView}
        initial={{ scope: 'odd', depth: 'deep', search: 4, groups: 'none', labels: 'yes', repel: Infinity }}
      />,
    );
    expect(screen.getByText('Nothing to show')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'All notes' })).toBeChecked();
    expect(within(graphList()).queryAllByRole('button')).toHaveLength(0);
  });

  it('asks for an open note in local scope', async () => {
    await createNote({ title: 'Combat' });
    render(<Stateful editor={GraphView} initial={{ scope: 'local', depth: 3 }} />);
    expect(screen.getByText('Open a note to see its links')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Depth' })).toHaveValue('3');
    expect(within(graphList()).queryAllByRole('button')).toHaveLength(0);
  });

  it('opens tag, unresolved and Loopy nodes from the node list', async () => {
    const user = userEvent.setup();
    const board = await createBoard({ name: 'Overworld' });
    const palette = await createPalette({
      name: 'Dusk',
      harmony: 'custom',
      baseIndex: 0,
      source: 'wheel',
      colours: [{ name: '', hex: '#ff8800' }],
    });
    const { ids } = await importFiles([file('hero.png', 'image/png')], 'auto');
    await ticketActions.create({ title: 'Boss fight', stateId: 'todo' });
    await createNote({
      title: 'Hub',
      body: '#enemy [[Arena]] [[board:Overworld]] [[palette:Dusk]] [[asset:hero.png]] [[ticket:SPA-1]]',
    });
    render(
      <Stateful
        editor={GraphView}
        initial={{ showTags: true, showAttachments: true, showUnresolved: true }}
      />,
    );
    const list = graphList();
    expect(
      within(list)
        .getAllByRole('button')
        .map((button) => button.textContent)
        .sort(),
    ).toEqual(['#enemy', 'Arena', 'Dusk', 'Hub', 'Overworld', 'SPA-1', 'hero.png']);
    await waitFor(() => {
      const fills = context.frame().filter((op) => op.name === 'fill');
      expect(fills.some((op) => op.fillStyle === '#16a34a')).toBe(true);
      expect(fills.some((op) => op.fillStyle === '#d97706')).toBe(true);
    });
    expect(context.frame().some((op) => op.name === 'stroke' && op.strokeStyle === '#888')).toBe(true);

    await user.click(within(list).getByRole('button', { name: '#enemy' }));
    expect(areaOf('notes')?.state['search']).toBe('tag:#enemy');

    await user.click(within(list).getByRole('button', { name: 'Overworld' }));
    expect(areaOf('board')?.state['boardId']).toBe(board.id);

    await user.click(within(list).getByRole('button', { name: 'Dusk' }));
    expect(areaOf('colours')?.state['paletteId']).toBe(palette.id);

    await user.click(within(list).getByRole('button', { name: 'hero.png' }));
    expect(areaOf('assets')?.state['selectedId']).toBe(ids[0]);

    await user.click(within(list).getByRole('button', { name: 'SPA-1' }));
    expect(renderHook(() => useSelectedTicketId()).result.current).toBe('ticket-1');

    await user.click(within(list).getByRole('button', { name: 'Arena' }));
    await waitFor(() => {
      expect(api.notesData.notes.map((note) => note.title)).toContain('Arena');
    });
  });

  it('changes every setting through the settings popover', async () => {
    const user = userEvent.setup();
    await createNote({ title: 'Combat', body: '#enemy' });
    await createNote({ title: 'Stamina', body: '[[Combat]] [[Missing]] [[board:Nowhere]]' });
    await createNote({ title: 'Lonely' });
    const changes = vi.fn();
    render(<Stateful editor={GraphView} onState={changes} />);
    await user.click(screen.getByRole('button', { name: 'Graph settings' }));

    await user.click(screen.getByRole('switch', { name: 'Tags' }));
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ showTags: true }));
    await user.click(screen.getByRole('switch', { name: 'Boards, palettes, files and tickets' }));
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ showAttachments: true }));
    await user.click(screen.getByRole('switch', { name: 'Unresolved links' }));
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ showUnresolved: true }));
    expect(within(graphList()).getByRole('button', { name: 'Missing' })).toBeInTheDocument();
    expect(within(graphList()).getByRole('button', { name: 'Nowhere' })).toBeInTheDocument();
    expect(within(graphList()).getByRole('button', { name: '#enemy' })).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Orphans' }));
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ showOrphans: false }));
    expect(within(graphList()).queryByRole('button', { name: 'Lonely' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Labels' }));
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ labels: false }));

    await user.type(screen.getByRole('searchbox', { name: 'Filter notes' }), 'Stamina');
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Stamina' }));
    expect(within(graphList()).queryByRole('button', { name: 'Combat' })).not.toBeInTheDocument();
    await user.clear(screen.getByRole('searchbox', { name: 'Filter notes' }));

    await user.click(screen.getByRole('button', { name: 'Add group' }));
    await user.click(screen.getByRole('button', { name: 'Add group' }));
    expect(changes).toHaveBeenLastCalledWith(
      expect.objectContaining({
        groups: [
          { query: '', colour: '#e11d48' },
          { query: '', colour: '#2563eb' },
        ],
      }),
    );
    const [firstQuery] = screen.getAllByRole('textbox', { name: 'Group query' });
    if (!firstQuery) throw new Error('No group query');
    await user.type(firstQuery, 'Combat');
    const [firstColour] = screen.getAllByLabelText('Group colour');
    if (!firstColour) throw new Error('No group colour');
    fireEvent.change(firstColour, { target: { value: '#00ff00' } });
    expect(changes).toHaveBeenLastCalledWith(
      expect.objectContaining({
        groups: [
          { query: 'Combat', colour: '#00ff00' },
          { query: '', colour: '#2563eb' },
        ],
      }),
    );
    const [, secondRemove] = screen.getAllByRole('button', { name: 'Remove group' });
    if (!secondRemove) throw new Error('No remove button');
    await user.click(secondRemove);
    expect(changes).toHaveBeenLastCalledWith(
      expect.objectContaining({ groups: [{ query: 'Combat', colour: '#00ff00' }] }),
    );

    fireEvent.change(screen.getByRole('slider', { name: 'Repel' }), { target: { value: '300' } });
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ repel: 300 }));
    fireEvent.change(screen.getByRole('slider', { name: 'Link distance' }), { target: { value: '100' } });
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ linkDistance: 100 }));
    fireEvent.change(screen.getByRole('slider', { name: 'Centre pull' }), { target: { value: '0.2' } });
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ centre: 0.2 }));
    fireEvent.change(screen.getByRole('slider', { name: 'Node size' }), { target: { value: '2' } });
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ nodeSize: 2 }));
  });

  it('colours notes by group', async () => {
    await createNote({ title: 'Combat' });
    render(
      <Stateful
        editor={GraphView}
        initial={{
          groups: [
            { query: '', colour: '#123456' },
            { query: 'Combat', colour: '#abcdef' },
          ],
        }}
      />,
    );
    await waitFor(() => {
      expect(context.frame().some((op) => op.name === 'fill' && op.fillStyle === '#abcdef')).toBe(true);
    });
  });

  it('shows the neighbourhood of the active note in local scope', async () => {
    const user = userEvent.setup();
    const combat = await createNote({ title: 'Combat' });
    await createNote({ title: 'Stamina', body: '[[Combat]] [[Sprint]]' });
    await createNote({ title: 'Sprint' });
    await createNote({ title: 'Lore' });
    act(() => {
      setActiveNote(combat.id);
    });
    const changes = vi.fn();
    render(<Stateful editor={GraphView} initial={{ scope: 'local' }} onState={changes} />);
    const names = () =>
      within(graphList())
        .getAllByRole('button')
        .map((button) => button.textContent)
        .sort();
    expect(names()).toEqual(['Combat', 'Stamina']);
    fireEvent.change(screen.getByRole('slider', { name: 'Depth' }), { target: { value: '2' } });
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ depth: 2 }));
    expect(names()).toEqual(['Combat', 'Sprint', 'Stamina']);

    await user.click(screen.getByRole('radio', { name: 'All notes' }));
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'global' }));
    expect(screen.queryByRole('slider', { name: 'Depth' })).not.toBeInTheDocument();
    expect(names()).toEqual(['Combat', 'Lore', 'Sprint', 'Stamina']);
    const calls = changes.mock.calls.length;
    await user.click(screen.getByRole('radio', { name: 'All notes' }));
    expect(changes.mock.calls.length).toBe(calls);
  });
});

describe('hover preview', () => {
  function renderPreview(link: LinkParts, options: { rect?: DOMRect; sourceId?: string | null } = {}) {
    const onEnter = vi.fn();
    const onLeave = vi.fn();
    const onLink = vi.fn();
    render(
      <TooltipProvider>
        <HoverPreview
          link={link}
          rect={options.rect ?? rect(40, 20)}
          sourceId={options.sourceId ?? null}
          onEnter={onEnter}
          onLeave={onLeave}
          onLink={onLink}
        />
      </TooltipProvider>,
    );
    return { onEnter, onLeave, onLink, tooltip: screen.getByRole('tooltip') };
  }

  it('previews a note section below the link and reports links and hovering', async () => {
    await createNote({ title: 'Arena' });
    await createNote({ title: 'Combat', body: '# Combat\n\nIntro\n\n## Rules\n\nSee [[Arena]] first.\n' });
    const { onEnter, onLeave, onLink, tooltip } = renderPreview({
      kind: 'note',
      target: 'Combat',
      subpath: 'Rules',
      alias: null,
    });
    expect(tooltip).toHaveStyle({ left: '40px', top: '42px', width: '420px' });
    expect(within(tooltip).getByText('Combat')).toBeInTheDocument();
    expect(within(tooltip).queryByText('Intro')).not.toBeInTheDocument();
    fireEvent.click(within(tooltip).getByRole('link', { name: 'Arena' }));
    expect(onLink).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'note', target: 'Arena' }),
      expect.anything(),
    );
    fireEvent.mouseEnter(tooltip);
    expect(onEnter).toHaveBeenCalled();
    fireEvent.mouseLeave(tooltip);
    expect(onLeave).toHaveBeenCalled();
  });

  it('ignores tag clicks inside the preview', async () => {
    await createNote({ title: 'Goblin', body: 'Sneaky #enemy' });
    const { onLink, tooltip } = renderPreview({ kind: 'note', target: 'Goblin', subpath: null, alias: null });
    await userEvent.setup().click(within(tooltip).getByRole('button', { name: '#enemy' }));
    expect(onLink).not.toHaveBeenCalled();
    expect(within(tooltip).getByText('Goblin')).toBeInTheDocument();
  });

  it('previews the source note for a same-note link and places it above near the edge', async () => {
    const source = await createNote({ title: 'Self', body: 'Own words' });
    const { tooltip } = renderPreview(
      { kind: 'note', target: '', subpath: null, alias: null },
      { rect: rect(window.innerWidth, window.innerHeight - 20), sourceId: source.id },
    );
    expect(tooltip).toHaveStyle({
      left: `${String(window.innerWidth - 428)}px`,
      top: `${String(window.innerHeight - 20 - 326)}px`,
    });
    expect(within(tooltip).getByText('Own words')).toBeInTheDocument();
  });

  it('keeps the preview on screen near the top edge', () => {
    const { tooltip } = renderPreview(
      { kind: 'note', target: 'Nowhere', subpath: null, alias: null },
      { rect: rect(0, 100, 60, window.innerHeight) },
    );
    expect(tooltip).toHaveStyle({ left: '8px', top: '8px' });
    expect(tooltip).toHaveTextContent('Nowhere does not exist yet. Click to create it.');
  });

  it('previews a board', async () => {
    await createBoard({ name: 'Overworld' });
    const { tooltip } = renderPreview({ kind: 'board', target: 'overworld', subpath: null, alias: null });
    expect(within(tooltip).getByText('Overworld')).toBeInTheDocument();
    expect(within(tooltip).getByText('Board')).toBeInTheDocument();
    expect(within(tooltip).queryByRole('img')).not.toBeInTheDocument();
  });

  it('previews a palette with its swatches', async () => {
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
    const { tooltip } = renderPreview({ kind: 'palette', target: 'Dusk', subpath: null, alias: null });
    expect(within(tooltip).getByText('Palette')).toBeInTheDocument();
    expect(within(tooltip).getByTitle('#ff8800')).toBeInTheDocument();
    expect(within(tooltip).getByTitle('#220044')).toBeInTheDocument();
  });

  it('previews an image file', async () => {
    const { ids } = await importFiles([file('hero.png', 'image/png')], 'auto');
    const { tooltip } = renderPreview({ kind: 'asset', target: 'hero.png', subpath: null, alias: null });
    expect(within(tooltip).getByText('File')).toBeInTheDocument();
    const image = tooltip.querySelector('img');
    expect(image).toHaveAttribute('src', assetUrl(ids[0] ?? ''));
  });

  it('previews a ticket with its state', async () => {
    await ticketActions.create({ title: 'Boss fight', stateId: 'doing' });
    const { tooltip } = renderPreview({ kind: 'ticket', target: 'SPA-1', subpath: null, alias: null });
    expect(within(tooltip).getByText('SPA-1 Boss fight')).toBeInTheDocument();
    expect(within(tooltip).getByText('Ticket · In progress')).toBeInTheDocument();
  });

  it('reports a missing Loopy item', () => {
    const { tooltip } = renderPreview({ kind: 'board', target: 'Ghost', subpath: null, alias: null });
    expect(tooltip).toHaveTextContent('Ghost was not found.');
  });
});

describe('quick switcher', () => {
  function renderSwitcher(onOpenChange = vi.fn()) {
    render(
      <TooltipProvider>
        <QuickSwitcher open onOpenChange={onOpenChange} />
      </TooltipProvider>,
    );
    return { onOpenChange, input: screen.getByRole('combobox', { name: 'Find or create a note' }) };
  }

  function selected() {
    return screen.getAllByRole('option').find((option) => option.getAttribute('aria-selected') === 'true');
  }

  it('says there are no notes yet', () => {
    renderSwitcher();
    expect(screen.getByText('No notes yet')).toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('moves the selection with arrow keys and opens the chosen note', async () => {
    const user = userEvent.setup();
    await createNote({ title: 'Combat' });
    const camera = await createNote({ title: 'Camera' });
    const { input, onOpenChange } = renderSwitcher();
    await user.type(input, 'ca');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toContain('Create ca');
    await user.keyboard('{ArrowUp}');
    expect(selected()).toHaveTextContent('Camera');
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(selected()).toHaveTextContent('Create ca');
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowDown}');
    expect(selected()).toHaveTextContent(/^Combat/);
    await user.keyboard('{ArrowUp}{Enter}');
    expect(areaOf('note')?.state['noteId']).toBe(camera.id);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('stops at the last note when no create row is offered', async () => {
    const user = userEvent.setup();
    await createNote({ title: 'Combat' });
    await createNote({ title: 'Combo' });
    const { input } = renderSwitcher();
    await user.type(input, 'combat');
    expect(screen.queryByRole('option', { name: /Create/ })).not.toBeInTheDocument();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(selected()).toHaveTextContent(/^Combat/);
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(api.notesData.notes).toHaveLength(2);
  });

  it('matches aliases and opens a note with the mouse', async () => {
    const user = userEvent.setup();
    const golem = await createNote({ title: 'Stone guardian', body: '---\naliases:\n  - Golem\n---\nBig.' });
    await createNote({ title: 'Combat' });
    renderSwitcher();
    expect(screen.getAllByRole('option')).toHaveLength(2);
    await user.type(screen.getByRole('combobox', { name: 'Find or create a note' }), 'golem');
    const option = screen.getByRole('option', { name: /Stone guardian/ });
    await user.hover(screen.getByRole('option', { name: 'Create golem' }));
    expect(screen.getByRole('option', { name: 'Create golem' })).toHaveAttribute('aria-selected', 'true');
    await user.hover(option);
    expect(option).toHaveAttribute('aria-selected', 'true');
    await user.click(option);
    expect(areaOf('note')?.state['noteId']).toBe(golem.id);
  });

  it('creates a note from the create row and from Enter on it', async () => {
    const user = userEvent.setup();
    const { input, onOpenChange } = renderSwitcher();
    await user.type(input, 'Crafting');
    await user.click(screen.getByRole('option', { name: 'Create Crafting' }));
    await waitFor(() => {
      expect(api.notesData.notes.map((note) => note.title)).toEqual(['Crafting']);
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(areaOf('note')?.state['noteId']).toBe(api.notesData.notes[0]?.id);

    await user.type(input, 'Mining{Enter}');
    await waitFor(() => {
      expect(api.notesData.notes.map((note) => note.title)).toEqual(['Crafting', 'Mining']);
    });
  });

  it('does nothing on Enter when there is nothing to open or create', async () => {
    const user = userEvent.setup();
    const { input, onOpenChange } = renderSwitcher();
    await user.type(input, '   {Enter}');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(api.notesData.notes).toHaveLength(0);
  });

  it('closes from the close button and clears the query', async () => {
    const user = userEvent.setup();
    const { input, onOpenChange } = renderSwitcher();
    await user.type(input, 'abc');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(input).toHaveValue('');
  });
});

describe('Loopy items', () => {
  it('finds tickets by number or key and resolves image URLs', async () => {
    await ticketActions.create({ title: 'Boss fight', stateId: 'todo' });
    await ticketActions.create({ title: 'Loose end', stateId: null });
    await ticketActions.create({ title: 'Third', stateId: 'done' });
    await createBoard({ name: 'Overworld' });
    const { ids } = await importFiles(
      [file('hero.png', 'image/png'), file('theme.mp3', 'audio/mpeg')],
      'auto',
    );
    const { result } = renderHook(() => useLoopyItems());
    const loopy = result.current;
    expect(loopy.find('ticket', 'SPA-3')?.detail).toBe('SPA-3 Third');
    expect(loopy.find('ticket', ' 1 ')).toEqual(
      expect.objectContaining({ id: 'ticket-1', stateName: 'To do', stateColour: '#64748b' }),
    );
    expect(loopy.find('ticket', 'SPA-2')).toEqual(
      expect.objectContaining({ detail: 'SPA-2 Loose end', stateName: null, stateColour: null }),
    );
    expect(loopy.find('ticket', 'SPA-9')).toBeNull();
    expect(loopy.find('ticket', 'boss')).toBeNull();
    expect(loopy.find('board', ' OVERWORLD ')?.name).toBe('Overworld');
    expect(loopy.find('palette', 'Overworld')).toBeNull();
    expect(loopy.items.asset.map((item) => item.detail)).toEqual(['image', 'audio']);
    expect(loopy.imageUrl(loopy.find('asset', 'hero.png'))).toBe(assetUrl(ids[0] ?? ''));
    expect(loopy.find('asset', 'theme.mp3')?.id).toBe(ids[1]);
    expect(loopy.imageUrl(loopy.find('asset', 'theme.mp3'))).toBeNull();
    expect(loopy.imageUrl(null)).toBeNull();
  });

  it('keeps the first of two items with the same name', async () => {
    const first = await createBoard({ name: 'Map' });
    await createBoard({ name: 'map' });
    const { result } = renderHook(() => useLoopyItems());
    expect(result.current.items.board).toHaveLength(2);
    expect(result.current.find('board', 'MAP')?.id).toBe(first.id);
  });

  it('lists nothing before boards and palettes load or without a project', () => {
    act(() => {
      resetBoardStore();
      resetPalettesStore();
      resetProjectStore();
    });
    const { result } = renderHook(() => useLoopyItems());
    expect(result.current.items.board).toEqual([]);
    expect(result.current.items.palette).toEqual([]);
    expect(result.current.find('board', 'Overworld')).toBeNull();
  });
});
