import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as DndKit from '@dnd-kit/core';
import type { DndContextProps } from '@dnd-kit/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardNode } from '@shared/board';
import { LayersEditor } from '@renderer/components/editors/Layers/LayersEditor';
import { TicketsEditor } from '@renderer/components/editors/Tickets/TicketsEditor';
import { AreaContext } from '@renderer/components/Shell/AreaContext';
import { importFiles } from '@renderer/lib/assets';
import {
  commitChanges,
  createBoard,
  createItem,
  loadBoard,
  setActiveBoard,
  useLiveLayers,
} from '@renderer/lib/board';
import { createCardTemplate } from '@renderer/lib/cards';
import { newLayer } from '@renderer/lib/drawing';
import { createPalette } from '@renderer/lib/palettes';
import { sprintActions, ticketActions } from '@renderer/lib/tickets';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

const dnd = vi.hoisted(() => ({ props: null as DndContextProps | null }));

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof DndKit>();
  function DndContext(props: DndContextProps) {
    dnd.props = props;
    return <actual.DndContext {...props} />;
  }
  return { ...actual, DndContext };
});

let api: FakeApi;

type DragData = Record<string, unknown> | undefined;

function active(id: string, data?: DragData) {
  return { id, data: { current: data }, rect: { current: { initial: null, translated: null } } };
}

function over(id: string, data?: DragData) {
  return {
    id,
    data: { current: data },
    disabled: false,
    rect: { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 },
  };
}

function dragEvent(activeId: string, activeData: DragData, target: ReturnType<typeof over> | null) {
  return {
    active: active(activeId, activeData),
    over: target,
    activatorEvent: new Event('pointerdown'),
    collisions: null,
    delta: { x: 0, y: 0 },
  };
}

function unnamed(node: BoardNode): BoardNode {
  const { name: _name, ...data } = node.data;
  return { ...node, data };
}

function handlers(): DndContextProps {
  const props = dnd.props;
  if (!props) throw new Error('no drag context');
  return props;
}

function Live() {
  const live = useLiveLayers();
  return <output aria-label="live">{JSON.stringify(live)}</output>;
}

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <AreaContext value={{ areaId: 'a', headerSlot: null }}>{children}</AreaContext>
      </ToastProvider>
    </TooltipProvider>
  );
}

beforeEach(async () => {
  dnd.props = null;
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

describe('layers labels and reordering', () => {
  it('names each kind of item from its content', async () => {
    const { ids } = await act(() =>
      importFiles([new File(['a'], 'theme.mp3', { type: 'audio/mpeg' })], 'auto'),
    );
    const palette = await createPalette({
      name: 'Dusk',
      harmony: 'custom',
      baseIndex: 0,
      source: 'wheel',
      colours: [{ name: '', hex: '#ff8800' }],
    });
    const template = await createCardTemplate({ name: 'Hero', fields: [] });
    const level = await createBoard({ name: 'Level' });
    const board = await createBoard({ name: 'Ideas' });
    await loadBoard(board.id);
    setActiveBoard(board.id);
    const boardId = board.id;
    const at = (preset: Parameters<typeof createItem>[0]['preset'], id: string, data = {}): BoardNode => ({
      ...createItem({ boardId, preset, rect: { x: 0, y: 0 }, z: 1, data }),
      id,
    });
    await commitChanges(boardId, {
      upsertNodes: [
        at('link', 'l1', { target: { kind: 'board', id: level.id } }),
        at('link', 'l2', { target: { kind: 'palette', id: palette.id } }),
        at('link', 'l3', { target: { kind: 'palette', id: 'gone' } }),
        at('file', 'f1', { assetId: ids[0] }),
        at('file', 'f2', { assetId: 'gone' }),
        at('sticky', 't1', { text: '' }),
        at('container', 'c1', { title: '' }),
        at('image', 'i1', { alt: 'Map' }),
        at('image', 'i2', {}),
        at('card', 'k1', { templateId: template.id, values: {} }),
        at('card', 'k2', { templateId: 'gone', values: {} }),
        at('sticky', 'n1', { text: 'Hidden', name: 'Named', hidden: true }),
        unnamed(newLayer({ boardId, name: 'Ink', z: 1, at: { x: 0, y: 0 } })),
      ],
    });
    render(
      <Providers>
        <LayersEditor areaId="l" state={{}} setState={() => undefined} />
      </Providers>,
    );
    const list = await screen.findByRole('list', { name: 'Layers' });
    const names = within(list)
      .getAllByRole('button', { pressed: false })
      .map((button) => button.textContent);
    expect(names).toEqual(
      expect.arrayContaining([
        'Level',
        'Dusk',
        'Link',
        'theme.mp3',
        'File',
        'Text',
        'Map',
        'Image',
        'Hero',
        'Card',
        'Named',
        'Container',
        'Drawing',
      ]),
    );
    expect(screen.getByRole('button', { name: 'Show Named' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show Named' }).closest('li')?.className).toContain('hidden');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Show Named' }));
    expect(vi.mocked(api.applyBoardChanges).mock.lastCall?.[1].upsertNodes?.[0]?.data).toMatchObject({
      hidden: false,
    });
  });

  it('previews and commits a new layer order among siblings only', async () => {
    const board = await createBoard({ name: 'Ideas' });
    await loadBoard(board.id);
    setActiveBoard(board.id);
    const boardId = board.id;
    const sticky = (id: string, z: number, parentId: string | null = null): BoardNode => ({
      ...createItem({ boardId, preset: 'sticky', rect: { x: z * 300, y: 0 }, z, data: { text: id } }),
      id,
      parentId,
    });
    await commitChanges(boardId, {
      upsertNodes: [
        { ...createItem({ boardId, preset: 'container', rect: { x: 0, y: 900 }, z: 4 }), id: 'room' },
        sticky('a', 1),
        sticky('b', 2),
        sticky('c', 3),
        sticky('inner', 5, 'room'),
      ],
    });
    render(
      <Providers>
        <LayersEditor areaId="l" state={{}} setState={() => undefined} />
        <Live />
      </Providers>,
    );
    await screen.findByRole('list', { name: 'Layers' });
    const live = () => screen.getByRole('status', { name: 'live' }).textContent;
    const parsed = (): unknown => JSON.parse(live());

    act(() => {
      handlers().onDragOver?.(dragEvent('a', undefined, over('c')));
    });
    expect(parsed()).toMatchObject({ a: 3 });
    act(() => {
      handlers().onDragCancel?.(dragEvent('a', undefined, null));
    });
    expect(live()).toBe('{}');

    const before = vi.mocked(api.applyBoardChanges).mock.calls.length;
    act(() => {
      handlers().onDragOver?.(dragEvent('a', undefined, over('inner')));
    });
    act(() => {
      handlers().onDragOver?.(dragEvent('a', undefined, null));
    });
    expect(live()).toBe('{}');
    act(() => {
      handlers().onDragEnd?.(dragEvent('a', undefined, null));
    });
    act(() => {
      handlers().onDragEnd?.(dragEvent('ghost', undefined, over('a')));
    });
    expect(vi.mocked(api.applyBoardChanges).mock.calls).toHaveLength(before);

    act(() => {
      handlers().onDragEnd?.(dragEvent('a', undefined, over('c')));
    });
    await waitFor(() => {
      expect(vi.mocked(api.applyBoardChanges).mock.calls.length).toBeGreaterThan(before);
    });
    const moved = vi.mocked(api.applyBoardChanges).mock.lastCall?.[1].upsertNodes ?? [];
    expect(moved.find((node) => node.id === 'a')?.z).toBe(3);
    expect(live()).toBe('{}');
  });

  it('keeps the old name when a rename is blank or unchanged', async () => {
    const user = userEvent.setup();
    const board = await createBoard({ name: 'Ideas' });
    await loadBoard(board.id);
    setActiveBoard(board.id);
    await commitChanges(board.id, {
      upsertNodes: [
        {
          ...createItem({ boardId: board.id, preset: 'sticky', rect: { x: 0, y: 0 }, z: 1 }),
          id: 'n',
          data: { text: 'Note' },
        },
      ],
    });
    render(
      <Providers>
        <LayersEditor areaId="l" state={{}} setState={() => undefined} />
      </Providers>,
    );
    const before = vi.mocked(api.applyBoardChanges).mock.calls.length;
    await user.dblClick(await screen.findByRole('button', { name: 'Note' }));
    const rename = screen.getByRole('textbox', { name: 'Layer name' });
    fireEvent.change(rename, { target: { value: '   ' } });
    fireEvent.blur(rename);
    await user.dblClick(screen.getByRole('button', { name: 'Note' }));
    fireEvent.blur(screen.getByRole('textbox', { name: 'Layer name' }));
    expect(vi.mocked(api.applyBoardChanges).mock.calls).toHaveLength(before);
    expect(screen.getByRole('button', { name: 'Note' })).toBeInTheDocument();
  });
});

describe('backlog dragging', () => {
  function Backlog({ search = '' }: { search?: string }) {
    return (
      <Providers>
        <TicketsEditor areaId="a" state={{ mode: 'backlog', search }} setState={() => undefined} />
      </Providers>
    );
  }

  const ticket = (id: string) => ({ type: 'ticket', id, stateId: null });
  const column = (key: string) => ({ type: 'column', key });

  async function seed() {
    await sprintActions.create({ name: 'Sprint 1' });
    await ticketActions.create({ title: 'Hero art', sprintId: 'sprint-1' });
    await ticketActions.create({ title: 'Hero code', sprintId: 'sprint-1' });
    await ticketActions.create({ title: 'Boss fight' });
  }

  it('moves a ticket from a sprint to the backlog and ignores other drags', async () => {
    await seed();
    render(<Backlog />);
    const backlog = await screen.findByRole('region', { name: 'Backlog' });
    expect(within(backlog).getByRole('button', { name: 'SPA-3 Boss fight' })).toBeInTheDocument();

    act(() => {
      handlers().onDragStart?.(dragEvent('column:x', column('x'), null));
      handlers().onDragOver?.(dragEvent('column:x', column('x'), over('column:backlog', column('backlog'))));
    });
    act(() => {
      handlers().onDragEnd?.(dragEvent('column:x', column('x'), over('column:backlog', column('backlog'))));
    });
    expect(api.moveTicket).not.toHaveBeenCalled();

    act(() => {
      handlers().onDragStart?.(dragEvent('ticket-1', ticket('ticket-1'), null));
    });
    expect(document.querySelectorAll('[aria-roledescription]').length).toBeGreaterThan(0);
    act(() => {
      handlers().onDragOver?.(
        dragEvent('ticket-1', ticket('ticket-1'), over('column:backlog', column('backlog'))),
      );
    });
    act(() => {
      handlers().onDragEnd?.(
        dragEvent('ticket-1', ticket('ticket-1'), over('column:backlog', column('backlog'))),
      );
    });
    await waitFor(() => {
      expect(api.moveTicket).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'ticket-1', sprintId: null }),
      );
    });
  });

  it('reorders within a sprint and resets on cancel', async () => {
    await seed();
    render(<Backlog />);
    await screen.findByRole('region', { name: 'Sprint 1' });
    act(() => {
      handlers().onDragStart?.(dragEvent('ticket-2', ticket('ticket-2'), null));
    });
    act(() => {
      handlers().onDragCancel?.(dragEvent('ticket-2', ticket('ticket-2'), null));
    });
    act(() => {
      handlers().onDragStart?.(dragEvent('ghost', ticket('ghost'), null));
    });
    act(() => {
      handlers().onDragEnd?.(dragEvent('ghost', ticket('ghost'), over('ticket-1', ticket('ticket-1'))));
    });
    expect(api.moveTicket).not.toHaveBeenCalled();
    act(() => {
      handlers().onDragStart?.(dragEvent('ticket-2', ticket('ticket-2'), null));
    });
    act(() => {
      handlers().onDragEnd?.(dragEvent('ticket-2', ticket('ticket-2'), over('ticket-1', ticket('ticket-1'))));
      handlers().onDragStart?.(dragEvent('ticket-3', ticket('ticket-3'), null));
    });
    act(() => {
      handlers().onDragEnd?.(
        dragEvent('ticket-3', ticket('ticket-3'), over('column:backlog', column('backlog'))),
      );
    });
    await waitFor(() => {
      expect(api.moveTicket).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'ticket-2', sprintId: 'sprint-1' }),
      );
    });
    await waitFor(() => {
      expect(api.moveTicket).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'ticket-3', sprintId: null }),
      );
    });
  });

  it('filters by search and creates a sprint', async () => {
    const user = userEvent.setup();
    await ticketActions.create({ title: 'Boss fight' });
    await ticketActions.create({ title: 'Menu' });
    render(<Backlog search="boss" />);
    const backlog = await screen.findByRole('region', { name: 'Backlog' });
    expect(within(backlog).getByRole('button', { name: 'SPA-1 Boss fight' })).toBeInTheDocument();
    expect(within(backlog).queryByRole('button', { name: 'SPA-2 Menu' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create sprint' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create sprint' }));
    const name = await screen.findByRole('textbox', { name: /Sprint name/ });
    expect(name).toHaveValue('Sprint 1');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create sprint' }));
    expect(api.createSprint).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sprint 1' }));
    expect(await screen.findByRole('region', { name: 'Sprint 1' })).toBeInTheDocument();
  });
});
