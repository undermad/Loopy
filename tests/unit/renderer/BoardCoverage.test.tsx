import { use, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as Flow from '@xyflow/react';
import type { Edge, FinalConnectionState, Node, ReactFlowProps } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardChanges, BoardEdge, BoardNode } from '@shared/board';
import { BoardActionsContext, type BoardActions } from '@renderer/components/editors/Board/BoardContext';
import { BoardEditor } from '@renderer/components/editors/Board/BoardEditor';
import { AreaContext } from '@renderer/components/Shell/AreaContext';
import { importFiles, reportAssetDrag } from '@renderer/lib/assets';
import {
  BOARD_CLIPBOARD_TYPE,
  commitChanges,
  copyItems,
  createBoard,
  createEdge,
  createItem,
  getBoardNodes,
  getBoardSelection,
  loadBoard,
  serialiseClip,
  setBoardSelection,
  setLiveLayers,
} from '@renderer/lib/board';
import { createCardTemplate } from '@renderer/lib/cards';
import { runEditCommand } from '@renderer/lib/commands';
import { getBrushState, newLayer } from '@renderer/lib/drawing';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

const captured = vi.hoisted(() => ({
  props: null as ReactFlowProps | null,
  actions: null as BoardActions | null,
}));

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof Flow>();
  function ReactFlow(props: ReactFlowProps) {
    captured.props = props;
    return (
      <actual.ReactFlow {...props}>
        <Probe />
        {props.children}
      </actual.ReactFlow>
    );
  }
  return { ...actual, ReactFlow };
});

function Probe() {
  captured.actions = use(BoardActionsContext);
  return null;
}

let api: FakeApi;
let boardId = '';
let latest: Record<string, unknown> = {};

function Harness({ initial = {} }: { initial?: Record<string, unknown> }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [state, setState] = useState<Record<string, unknown>>(initial);
  latest = state;
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <div ref={setSlot} />
        <AreaContext value={{ areaId: 'a', headerSlot: slot }}>
          <BoardEditor
            areaId="a"
            state={state}
            setState={(patch) => {
              setState((current) => ({ ...current, ...patch }));
            }}
          />
        </AreaContext>
      </ToastProvider>
    </TooltipProvider>
  );
}

function sticky(id: string, x: number, y: number, extra: Partial<BoardNode> = {}): BoardNode {
  return {
    ...createItem({ boardId, preset: 'sticky', rect: { x, y }, z: 1, data: { text: id } }),
    id,
    ...extra,
  };
}

function room(): BoardNode {
  return {
    ...createItem({ boardId, preset: 'container', rect: { x: 0, y: 0, width: 600, height: 400 }, z: 1 }),
    id: 'room',
    data: { title: 'Room' },
  };
}

async function open(nodes: BoardNode[], edges: BoardEdge[] = [], initial: Record<string, unknown> = {}) {
  await commitChanges(boardId, { upsertNodes: nodes, upsertEdges: edges }, { history: false });
  render(<Harness initial={initial} />);
  await screen.findByRole('toolbar', { name: 'Board tools' });
  const surface = document.querySelector<HTMLElement>('[data-tool]');
  if (!surface) throw new Error('missing surface');
  return surface;
}

function props(): ReactFlowProps {
  const current = captured.props;
  if (!current) throw new Error('flow not rendered');
  return current;
}

function actions(): BoardActions {
  const current = captured.actions;
  if (!current) throw new Error('actions not rendered');
  return current;
}

function flowNode(id: string): Node {
  const node = props().nodes?.find((candidate) => candidate.id === id);
  if (!node) throw new Error(`missing node ${id}`);
  return node;
}

function flowEdge(id: string): Edge {
  const edge = props().edges?.find((candidate) => candidate.id === id);
  if (!edge) throw new Error(`missing edge ${id}`);
  return edge;
}

function native(init: { altKey?: boolean } = {}) {
  return new MouseEvent('mousemove', init);
}

function mouse(init: { altKey?: boolean; shiftKey?: boolean; clientX?: number; clientY?: number } = {}) {
  const event = new MouseEvent('click', { bubbles: true, ...init });
  return event as unknown as ReactMouseEvent;
}

function at(target: EventTarget, clientX: number, clientY: number) {
  return { target, clientX, clientY } as unknown as ReactMouseEvent<HTMLDivElement>;
}

function changes(): BoardChanges[] {
  return vi.mocked(api.applyBoardChanges).mock.calls.map((call) => call[1]);
}

function node(id: string): BoardNode | undefined {
  return getBoardNodes(boardId).find((candidate) => candidate.id === id);
}

function selected(): string[] {
  return getBoardSelection(boardId).nodeIds;
}

function selectIds(ids: string[], edgeIds: string[] = []) {
  act(() => {
    setBoardSelection(boardId, ids, edgeIds);
  });
}

function drag(id: string, to: { x: number; y: number }, init: { altKey?: boolean } = {}) {
  act(() => {
    props().onNodeDragStart?.(native(init), flowNode(id), [flowNode(id)]);
  });
  act(() => {
    props().onNodesChange?.([{ type: 'position', id, position: to, dragging: true }]);
  });
  act(() => {
    props().onNodeDrag?.(native(), flowNode(id), [flowNode(id)]);
  });
}

function drop(id: string, to: { x: number; y: number }) {
  act(() => {
    props().onNodesChange?.([{ type: 'position', id, position: to, dragging: false }]);
  });
  act(() => {
    props().onNodeDragStop?.(native(), flowNode(id), [flowNode(id)]);
  });
}

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return DOMRect.fromRect({ x, y, width, height });
}

beforeEach(async () => {
  captured.props = null;
  captured.actions = null;
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
  const board = await createBoard({ name: 'Ideas' });
  boardId = board.id;
  await loadBoard(boardId);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('dragging items on the board', () => {
  it('docks to a neighbour, shows guides and detaches with Alt', async () => {
    await open([sticky('a', 0, 0), sticky('b', 400, 0), sticky('c', 0, 600)]);
    drag('a', { x: 195, y: 3 });
    expect(document.querySelector('.dockHint')).not.toBeNull();
    drop('a', { x: 195, y: 3 });
    expect(document.querySelector('.dockHint')).toBeNull();
    await waitFor(() => {
      expect(typeof node('a')?.data['dock']).toBe('string');
    });
    expect(node('b')?.data['dock']).toBe(node('a')?.data['dock']);

    drag('c', { x: 800, y: 2 });
    expect(document.querySelectorAll('.guide').length).toBeGreaterThan(0);
    drop('c', { x: 800, y: 2 });
    expect(document.querySelectorAll('.guide')).toHaveLength(0);
    await waitFor(() => {
      expect(node('c')).toMatchObject({ x: 800, y: 0 });
    });

    drag('b', { x: 400, y: 300 }, { altKey: true });
    drop('b', { x: 400, y: 300 });
    await waitFor(() => {
      expect(node('b')?.data['dock']).toBeNull();
    });
  });

  it('moves docked followers along and moves into a container', async () => {
    await open([
      room(),
      sticky('a', 700, 0, { data: { text: 'a', dock: 'd' } }),
      sticky('b', 900, 0, { data: { text: 'b', dock: 'd' } }),
      { ...newLayer({ boardId, name: 'Ink', z: 1, at: { x: 2000, y: 2000 } }), id: 'ink' },
    ]);
    drag('a', { x: 100, y: 100 });
    drop('a', { x: 100, y: 100 });
    await waitFor(() => {
      expect(node('a')?.parentId).toBe('room');
    });
    expect(changes().some((change) => change.upsertNodes?.some((item) => item.id === 'b'))).toBe(true);

    drag('ink', { x: 2100, y: 2100 });
    drop('ink', { x: 2100, y: 2100 });
    await waitFor(() => {
      expect(node('ink')).toMatchObject({ x: 2100, y: 2100, parentId: null });
    });
  });
});

describe('drag edge cases', () => {
  it('ignores unrelated changes during a drag and stray drag events', async () => {
    const surface = await open([
      room(),
      sticky('inner', 10, 40, { parentId: 'room' }),
      sticky('a', 700, 0, { data: { text: 'a', dock: 'd' } }),
      sticky('b', 900, 0, { data: { text: 'b', dock: 'd' } }),
      sticky('c', 700, 600),
    ]);
    const before = changes().length;
    act(() => {
      props().onNodeDragStop?.(native(), flowNode('a'), [flowNode('a')]);
      props().onNodeDrag?.(native(), { ...flowNode('a'), id: 'ghost' }, []);
    });
    expect(changes()).toHaveLength(before);

    act(() => {
      props().onNodeDragStart?.(native(), flowNode('inner'), [flowNode('inner')]);
    });
    act(() => {
      props().onNodeDrag?.(native(), flowNode('inner'), [flowNode('inner')]);
    });
    expect(actions().dropTarget).toEqual({ id: 'room', kind: 'stay' });
    act(() => {
      props().onNodesChange?.([
        { type: 'select', id: 'c', selected: true },
        { type: 'select', id: 'b', selected: true },
      ]);
    });
    expect(selected()).toEqual(expect.arrayContaining(['b', 'c']));
    act(() => {
      props().onNodesChange?.([
        { type: 'position', id: 'inner', position: { x: 20, y: 50 }, dragging: false },
        { type: 'position', id: 'c', position: { x: 710, y: 610 } },
      ]);
    });
    act(() => {
      props().onNodeDragStop?.(native(), flowNode('inner'), [flowNode('inner')]);
    });
    await waitFor(() => {
      expect(node('inner')).toMatchObject({ x: 20, y: 50, parentId: 'room' });
    });

    act(() => {
      props().onNodeDragStart?.(native(), flowNode('a'), [flowNode('a')]);
    });
    act(() => {
      props().onNodesChange?.([{ type: 'position', id: 'a', position: { x: 720, y: 0 } }]);
    });
    act(() => {
      props().onNodeDragStop?.(native(), flowNode('a'), [flowNode('a')]);
    });
    await waitFor(() => {
      expect(node('b')?.x).toBe(920);
    });

    act(() => {
      props().onNodeDragStop?.(native(), flowNode('a'), [flowNode('a')]);
    });
    selectIds([]);
    const count = getBoardNodes(boardId).length;
    fireEvent.keyDown(surface, { key: 'd', ctrlKey: true });
    expect(getBoardNodes(boardId)).toHaveLength(count);
    const empty = serialiseClip(copyItems([], getBoardNodes(boardId), [], {}));
    fireEvent.paste(surface, {
      clipboardData: {
        files: [],
        getData: (type: string) => (type === BOARD_CLIPBOARD_TYPE ? empty : ''),
        setData: () => undefined,
      },
    });
    expect(getBoardNodes(boardId)).toHaveLength(count);
    selectIds(['a', 'c']);
    fireEvent.keyDown(surface, { key: 'Escape' });
    expect(selected()).toEqual([]);
  });
});

describe('react flow callbacks', () => {
  it('selects, resizes and removes through node and edge changes', async () => {
    const edge = createEdge(boardId, 'a', 'b', {});
    await open(
      [
        room(),
        sticky('inner', 10, 40, { parentId: 'room' }),
        sticky('a', 700, 0, { data: { text: 'a', dock: 'd' } }),
        sticky('b', 900, 0, { data: { text: 'b', dock: 'd' } }),
      ],
      [edge],
    );
    act(() => {
      props().onNodesChange?.([{ type: 'select', id: 'a', selected: true }]);
    });
    expect(selected()).toEqual(expect.arrayContaining(['a', 'b']));
    act(() => {
      props().onNodesChange?.([
        {
          type: 'dimensions',
          id: 'a',
          dimensions: { width: 260, height: 140 },
          resizing: false,
          setAttributes: true,
        },
      ]);
    });
    await waitFor(() => {
      expect(node('a')).toMatchObject({ width: 260, height: 140 });
    });

    act(() => {
      props().onEdgesChange?.([{ type: 'select', id: edge.id, selected: true }]);
    });
    expect(getBoardSelection(boardId).edgeIds).toEqual([edge.id]);
    act(() => {
      props().onEdgeDoubleClick?.(mouse(), flowEdge(edge.id));
    });
    expect(actions().editingId).toBe(edge.id);
    act(() => {
      props().onEdgesChange?.([{ type: 'remove', id: edge.id }]);
    });
    expect(changes().at(-1)?.removeEdgeIds).toEqual([edge.id]);

    act(() => {
      props().onNodesChange?.([{ type: 'remove', id: 'room' }]);
    });
    expect(changes().at(-1)?.removeNodeIds).toEqual(expect.arrayContaining(['room', 'inner']));
  });

  it('connects items, ignores self links and remembers the viewport', async () => {
    await open([sticky('a', 0, 0), sticky('b', 600, 0)]);
    const before = changes().length;
    act(() => {
      props().onConnect?.({ source: 'a', target: 'a', sourceHandle: null, targetHandle: null });
      props().onConnect?.({ source: 'a', target: 'ghost', sourceHandle: null, targetHandle: null });
    });
    expect(changes()).toHaveLength(before);
    act(() => {
      props().onConnect?.({ source: 'a', target: 'b', sourceHandle: 'bottom', targetHandle: 'nope' });
    });
    expect(changes().at(-1)?.upsertEdges?.[0]).toMatchObject({
      sourceId: 'a',
      targetId: 'b',
      data: { sourceHandle: 'bottom', targetHandle: 'left' },
    });
    act(() => {
      props().onConnect?.({ source: 'b', target: 'a', sourceHandle: null, targetHandle: 'top' });
    });
    expect(changes().at(-1)?.upsertEdges?.[0]).toMatchObject({
      data: { sourceHandle: 'left', targetHandle: 'top' },
    });
    act(() => {
      props().onMoveEnd?.(null, { x: 5, y: 6, zoom: 2 });
    });
    expect(latest['viewport']).toEqual({ x: 5, y: 6, zoom: 2 });
  });

  it('opens quick create when a connection ends on empty canvas', async () => {
    await open([sticky('a', 0, 0)]);
    const state = (extra: Partial<FinalConnectionState> = {}) =>
      ({
        isValid: false,
        toNode: null,
        fromNode: flowNode('a'),
        fromHandle: { id: 'right' },
        ...extra,
      }) as unknown as FinalConnectionState;
    act(() => {
      props().onConnectEnd?.(
        new MouseEvent('mouseup', { clientX: 400, clientY: 300 }),
        state({ isValid: true }),
      );
      props().onConnectEnd?.(new MouseEvent('mouseup'), state({ fromNode: null }));
    });
    expect(screen.queryByRole('dialog', { name: 'Quick create' })).not.toBeInTheDocument();
    const touch = { changedTouches: [] } as unknown as TouchEvent;
    act(() => {
      props().onConnectEnd?.(touch, state());
    });
    expect(screen.queryByRole('dialog', { name: 'Quick create' })).not.toBeInTheDocument();
    const touched = { changedTouches: [{ clientX: 400, clientY: 300 }] } as unknown as TouchEvent;
    act(() => {
      props().onConnectEnd?.(touched, state());
    });
    fireEvent.click(screen.getByRole('option', { name: 'Rectangle' }));
    const placed = changes().at(-2)?.upsertNodes?.[0];
    expect(changes().at(-1)?.upsertEdges?.[0]).toMatchObject({
      sourceId: 'a',
      targetId: placed?.id,
      data: { sourceHandle: 'right' },
    });

    act(() => {
      props().onConnectEnd?.(
        new MouseEvent('mouseup', { clientX: 10, clientY: 10 }),
        state({ fromHandle: { id: 'odd' } } as Partial<FinalConnectionState>),
      );
    });
    fireEvent.click(screen.getByRole('option', { name: 'Empty image' }));
    expect(changes().at(-1)?.upsertEdges?.[0]?.data['sourceHandle']).not.toBe('odd');
  });

  it('handles clicks and double clicks on items and the pane', async () => {
    await open([
      room(),
      sticky('inner', 10, 40, { parentId: 'room' }),
      sticky('a', 700, 0, { data: { text: 'a', dock: 'd' } }),
      sticky('b', 900, 0, { data: { text: 'b', dock: 'd' } }),
    ]);
    const surface = document.querySelector<HTMLElement>('[data-tool]');
    if (!surface) throw new Error('missing surface');
    selectIds(['a', 'b']);
    fireEvent.pointerDown(surface);
    act(() => {
      props().onNodeClick?.(mouse({ shiftKey: true }), flowNode('a'));
    });
    expect(selected()).toEqual(['a', 'b']);
    act(() => {
      props().onNodeClick?.(mouse(), flowNode('a'));
    });
    expect(selected()).toEqual(['a']);

    act(() => {
      props().onNodeDoubleClick?.(mouse({ clientX: 50, clientY: 60 }), flowNode('a'));
    });
    expect(selected()).toEqual(['a']);
    act(() => {
      props().onNodeDoubleClick?.(mouse({ clientX: 50, clientY: 60 }), flowNode('room'));
    });
    expect(selected()).toEqual(['inner']);

    const count = getBoardNodes(boardId).length;
    const elsewhere = document.createElement('div');
    act(() => {
      props().onDoubleClick?.(at(elsewhere, 2000, 2000));
    });
    expect(getBoardNodes(boardId)).toHaveLength(count);
    const pane = document.createElement('div');
    pane.classList.add('react-flow__pane');
    act(() => {
      props().onDoubleClick?.(at(pane, 2000, 2000));
    });
    expect(getBoardNodes(boardId)).toHaveLength(count + 1);
    expect(actions().editingId).toBe(selected()[0]);
  });

  it('ignores clicks while another tool is active', async () => {
    await open([room(), sticky('inner', 10, 40, { parentId: 'room' })], [], { tool: 'hand' });
    act(() => {
      props().onNodeClick?.(mouse(), flowNode('room'));
      props().onNodeDoubleClick?.(mouse({ clientX: 50, clientY: 60 }), flowNode('room'));
    });
    expect(selected()).toEqual([]);
    const pane = document.createElement('div');
    pane.classList.add('react-flow__pane');
    const count = getBoardNodes(boardId).length;
    act(() => {
      props().onDoubleClick?.(at(pane, 10, 10));
    });
    expect(getBoardNodes(boardId)).toHaveLength(count);
  });
});

describe('board actions given to items', () => {
  it('previews rotations and geometry and follows board links', async () => {
    const other = await createBoard({ name: 'Dungeon' });
    await open([
      sticky('a', 0, 0, { data: { text: 'a', dock: 'd' } }),
      sticky('b', 200, 0, { data: { text: 'b', dock: 'd' } }),
      sticky('c', 900, 0),
    ]);
    act(() => {
      actions().previewRotation('a', 30);
    });
    expect(flowNode('b').position).not.toEqual({ x: 200, y: 0 });
    act(() => {
      actions().previewRotation('c', 30);
    });
    act(() => {
      actions().previewRotation('a', null);
    });
    expect(flowNode('b').position).toEqual({ x: 200, y: 0 });
    const target = node('c');
    if (!target) throw new Error('missing c');
    act(() => {
      actions().rotateItem(target, 45);
    });
    expect(changes().at(-1)?.upsertNodes?.[0]?.data['rotation']).toBe(45);

    selectIds(['a', 'b']);
    act(() => {
      actions().previewGeometry('a', { x: 0, y: 0, width: 300, height: 120 });
    });
    expect(flowNode('a').width).toBe(300);
    act(() => {
      actions().previewGeometry('a', null);
      actions().previewGeometry('ghost', { x: 0, y: 0, width: 1, height: 1 });
    });
    expect(actions().gridStep(1)).toBeGreaterThan(0);
    act(() => {
      actions().updateNode({ ...target, data: { ...target.data, text: 'renamed' } });
    });
    expect(changes().at(-1)?.upsertNodes?.[0]?.data['text']).toBe('renamed');
    const edge = createEdge(boardId, 'a', 'c', {});
    act(() => {
      actions().updateEdge(edge);
    });
    expect(changes().at(-1)?.upsertEdges?.[0]?.id).toBe(edge.id);

    act(() => {
      actions().openLink({ kind: 'board', id: boardId });
    });
    expect(latest['boardId']).toBeUndefined();
    act(() => {
      actions().openLink({ kind: 'board', id: other.id });
    });
    expect(latest).toMatchObject({ boardId: other.id, boardTrail: [boardId] });
    const back = await screen.findByRole('button', { name: 'Back to Ideas' });
    fireEvent.click(back);
    expect(latest).toMatchObject({ boardId, boardTrail: [] });
  });

  it('resizes a whole docked group and splits it at a seam', async () => {
    await open([
      sticky('a', 0, 0, { data: { text: 'a', dock: 'd' } }),
      sticky('b', 200, 0, { data: { text: 'b', dock: 'd' } }),
    ]);
    selectIds(['a', 'b']);
    const frame = await screen.findByRole('group', { name: 'Docked group' });
    const east = frame.querySelector<HTMLElement>('[data-resize="e"]');
    if (!east) throw new Error('missing handle');
    fireEvent.pointerDown(east, { button: 0, clientX: 400, clientY: 60, pointerId: 3 });
    fireEvent.pointerMove(east, { clientX: 500, clientY: 60, pointerId: 3 });
    expect(flowNode('b').width).toBeGreaterThan(200);
    fireEvent.pointerUp(east, { clientX: 500, clientY: 60, pointerId: 3 });
    await waitFor(() => {
      expect((node('b')?.width ?? 0) + (node('a')?.width ?? 0)).toBeGreaterThan(400);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Detach these items' }));
    await waitFor(() => {
      expect(node('a')?.data['dock']).toBeNull();
    });
  });

  it('shows live layer order while the layers panel drags', async () => {
    await open([sticky('a', 0, 0, { z: 1 }), sticky('b', 300, 0, { z: 2 })]);
    const a = node('a');
    if (!a) throw new Error('missing a');
    act(() => {
      setLiveLayers([{ ...a, z: 5 }]);
    });
    expect(flowNode('a').zIndex).toBeGreaterThan(flowNode('b').zIndex ?? 0);
    act(() => {
      setLiveLayers(null);
    });
  });
});

describe('board keyboard and clipboard', () => {
  it('distributes vertically, selects docks with Escape and unlocks with Ctrl+L', async () => {
    const surface = await open([
      sticky('a', 0, 0, { data: { text: 'a', dock: 'd', locked: true } }),
      sticky('b', 200, 0, { data: { text: 'b', dock: 'd', locked: true } }),
      sticky('c', 0, 900),
    ]);
    selectIds(['a']);
    fireEvent.keyDown(surface, { key: 'Escape' });
    expect(selected()).toEqual(['a', 'b']);
    fireEvent.keyDown(surface, { key: 'l', ctrlKey: true });
    expect(
      changes()
        .at(-1)
        ?.upsertNodes?.every((item) => item.data['locked'] === false),
    ).toBe(true);
    selectIds(['a', 'b', 'c']);
    fireEvent.keyDown(surface, { key: 'V', code: 'KeyV', altKey: true, shiftKey: true });
    expect(
      changes()
        .at(-1)
        ?.upsertNodes?.map((item) => item.id),
    ).toContain('b');
    fireEvent.keyDown(surface, { key: 'V', code: 'KeyV', altKey: true });
  });

  it('keeps locked items when deleting and ignores keys while typing', async () => {
    const surface = await open([sticky('a', 0, 0, { data: { text: 'a', locked: true } })]);
    selectIds(['a']);
    act(() => {
      surface.focus();
    });
    const before = changes().length;
    act(() => {
      runEditCommand('delete');
    });
    expect(changes()).toHaveLength(before);
    expect(node('a')).toBeDefined();

    fireEvent.keyDown(surface, { key: ' ' });
    const search = screen.getByRole('textbox', { name: 'Search items' });
    const data: Record<string, string> = {};
    const clipboardData = {
      files: [],
      setData: (type: string, value: string) => {
        data[type] = value;
      },
      getData: (type: string) => data[type] ?? '',
    };
    fireEvent.copy(search, { clipboardData });
    expect(data).toEqual({});
    data['text/plain'] = 'typed';
    fireEvent.paste(search, { clipboardData });
    expect(getBoardNodes(boardId)).toHaveLength(1);
    act(() => {
      search.focus();
    });
    let handled = true;
    act(() => {
      handled = runEditCommand('selectAll');
    });
    expect(handled).toBe(false);
  });

  it('pastes board items from their JSON and system clipboard images and clips', async () => {
    const surface = await open([sticky('a', 0, 0)]);
    const snapshot = getBoardNodes(boardId);
    const json = serialiseClip(copyItems(['a'], snapshot, [], {}));
    const store: Record<string, string> = { [BOARD_CLIPBOARD_TYPE]: json, 'text/plain': 'unrelated' };
    fireEvent.paste(surface, {
      clipboardData: { files: [], getData: (type: string) => store[type] ?? '', setData: () => undefined },
    });
    expect(getBoardNodes(boardId)).toHaveLength(2);

    selectIds(['a']);
    let copied = '';
    const read = vi.fn(() =>
      Promise.resolve([
        { types: ['text/plain'], getType: () => Promise.resolve(new Blob([copied])) },
        { types: ['image/png'], getType: () => Promise.resolve(new Blob(['png'])) },
      ]),
    );
    const writeText = vi.fn((text: string) => {
      copied = text;
      return Promise.resolve();
    });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText, read }, configurable: true });
    act(() => {
      surface.focus();
    });
    act(() => {
      runEditCommand('copy');
    });
    expect(copied).not.toBe('');
    await act(async () => {
      runEditCommand('paste');
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(getBoardNodes(boardId)).toHaveLength(3);
    });

    read.mockResolvedValueOnce([{ types: ['image/png'], getType: () => Promise.resolve(new Blob(['png'])) }]);
    await act(async () => {
      runEditCommand('paste');
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(getBoardNodes(boardId).some((item) => item.type === 'image')).toBe(true);
    });
    read.mockResolvedValueOnce([{ types: ['text/html'], getType: () => Promise.resolve(new Blob([''])) }]);
    const count = getBoardNodes(boardId).length;
    await act(async () => {
      runEditCommand('paste');
      await Promise.resolve();
    });
    expect(getBoardNodes(boardId)).toHaveLength(count);
  });

  it('resizes the brush with brackets and resets modifiers on blur', async () => {
    const surface = await open([sticky('a', 0, 0)], [], { tool: 'eraser' });
    const size = getBrushState().eraser.settings.size;
    fireEvent.keyDown(surface, { key: ']' });
    expect(getBrushState().eraser.settings.size).toBeGreaterThan(size);
    fireEvent.keyDown(surface, { key: '[' });
    fireEvent.keyDown(surface, { key: '[' });
    expect(getBrushState().eraser.settings.size).toBeLessThan(size);

    fireEvent.keyDown(surface, { key: 'Escape' });
    expect(latest['tool']).toBe('select');
    fireEvent.keyDown(window, { key: 'Control', ctrlKey: true });
    expect(actions().snapping).toBe(true);
    fireEvent.blur(window);
    expect(actions().snapping).toBe(false);
  });
});

describe('dropping assets', () => {
  it('fills a card image field, stacks dropped files and snaps to the grid', async () => {
    const { ids } = await act(() =>
      importFiles(
        [
          new File(['p'], 'map.png', { type: 'image/png' }),
          new File(['a'], 'theme.mp3', { type: 'audio/mpeg' }),
        ],
        'auto',
      ),
    );
    const [imageId = '', audioId = ''] = ids;
    const template = await createCardTemplate({
      name: 'Hero',
      width: 300,
      height: 300,
      fields: [{ id: 'face', kind: 'image', label: 'Face' }],
    });
    const card = {
      ...createItem({
        boardId,
        preset: 'card',
        rect: { x: 0, y: 0, width: 300, height: 300 },
        z: 1,
        data: { templateId: template.id, values: {} },
      }),
      id: 'card',
    };
    const surface = await open([card], [], { snap: true });
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([surface]);
    const field = document.querySelector<HTMLElement>('[data-field-id="face"]');
    if (!field) throw new Error('missing field');
    vi.spyOn(field, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 300, 300));

    act(() => {
      reportAssetDrag([imageId], 150, 150, 'drop');
    });
    expect(node('card')?.data['values']).toEqual({ face: imageId });

    act(() => {
      reportAssetDrag([imageId], 120, 280, 'move');
    });
    act(() => {
      reportAssetDrag([imageId], 120, 280, 'cancel');
    });
    act(() => {
      reportAssetDrag([imageId, audioId], 1000, 1000, 'drop', [{ kind: 'board', id: 'elsewhere' }]);
    });
    const placed = changes().at(-1)?.upsertNodes ?? [];
    expect(placed.map((item) => item.type)).toEqual(['image', 'file', 'link']);
    expect(placed.every((item) => item.x % 1 === 0)).toBe(true);
    expect(placed[1]?.y).toBeGreaterThan(placed[0]?.y ?? 0);

    const empty = changes().length;
    fireEvent.drop(surface, { clientX: 10, clientY: 10, dataTransfer: { types: ['Files'], files: [] } });
    expect(changes()).toHaveLength(empty);
  });

  it('places assets from the toolbar and opens the template editor from it', async () => {
    const user = userEvent.setup();
    const { ids } = await act(() => importFiles([new File(['p'], 'map.png', { type: 'image/png' })], 'auto'));
    const template = await createCardTemplate({ name: 'Hero', fields: [] });
    const surface = await open([]);
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 800, 600));

    await user.click(screen.getByRole('button', { name: 'Image' }));
    await user.click(await screen.findByRole('menuitem', { name: 'map.png' }));
    expect(changes().at(-1)?.upsertNodes?.[0]?.data).toMatchObject({ assetId: ids[0], alt: 'map.png' });

    api.assetsData.pickQueue.push([{ name: 'shot.png', mime: 'image/png', bytes: new Uint8Array([1]) }]);
    await user.click(screen.getByRole('button', { name: 'Image' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Image from file…' }));
    await waitFor(() => {
      expect(changes().at(-1)?.upsertNodes?.[0]?.type).toBe('image');
    });

    await user.click(screen.getByRole('button', { name: 'Card' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Hero' }));
    expect(latest).toMatchObject({ cardTemplate: template.id, tool: 'card' });

    await user.click(screen.getByRole('button', { name: 'Card' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit card templates…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Card template' });
    expect(within(dialog).getByRole('textbox', { name: 'Template name' })).toHaveValue('Hero');
    const name = within(dialog).getByRole('textbox', { name: 'Template name' });
    await user.clear(name);
    await user.type(name, 'Villain');
    await user.click(within(dialog).getByRole('button', { name: 'Save template' }));
    await waitFor(() => {
      expect(api.updateCardTemplate).toHaveBeenCalled();
    });
    expect(latest['cardTemplate']).toBe(template.id);
    await user.click(first(within(dialog).getAllByRole('button', { name: 'Close' })));
    expect(screen.queryByRole('dialog', { name: 'Card template' })).not.toBeInTheDocument();
  });
});

describe('quick create from the + buttons', () => {
  it('adds images, cards and same items above and to the left', async () => {
    const user = userEvent.setup();
    const { ids } = await act(() => importFiles([new File(['p'], 'map.png', { type: 'image/png' })], 'auto'));
    await createCardTemplate({ name: 'Hero', width: 200, height: 220, fields: [] });
    const surface = await open([sticky('a', 0, 0)]);
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 800, 600));

    selectIds(['a']);
    await user.click(screen.getByRole('button', { name: 'Add a connected item above' }));
    await user.click(screen.getByRole('option', { name: 'map.png' }));
    const image = changes().find((change) => change.upsertNodes?.[0]?.type === 'image')?.upsertNodes?.[0];
    expect(image?.data).toMatchObject({ assetId: ids[0] });
    expect(image?.y).toBeLessThan(0);

    selectIds(['a']);
    await user.click(screen.getByRole('button', { name: 'Add a connected item above' }));
    await user.click(screen.getByRole('option', { name: 'Same as this item' }));
    expect(changes().at(-1)?.upsertEdges?.[0]).toMatchObject({ data: { sourceHandle: 'top' } });

    act(() => {
      actions().setEditingId(null);
    });
    selectIds(['a']);
    await user.click(screen.getByRole('button', { name: 'Add a connected item to the left' }));
    await user.click(screen.getByRole('option', { name: 'Container' }));
    expect(actions().editingId).not.toBeNull();

    act(() => {
      actions().setEditingId(null);
    });
    selectIds(['a']);
    await user.click(screen.getByRole('button', { name: 'Add a connected item below' }));
    await user.click(screen.getByRole('option', { name: 'Hero' }));
    const card = changes().find((change) => change.upsertNodes?.[0]?.type === 'card')?.upsertNodes?.[0];
    expect(card?.y).toBeGreaterThan(100);
  });
});

describe('board context menu', () => {
  it('detaches, sends back and edits the template of items', async () => {
    const user = userEvent.setup();
    const template = await createCardTemplate({ name: 'Hero', fields: [] });
    await open([
      sticky('a', 0, 0, { z: 3, data: { text: 'Alpha', dock: 'd' } }),
      sticky('b', 200, 0, { z: 2, data: { text: 'Beta', dock: 'd' } }),
      {
        ...createItem({
          boardId,
          preset: 'card',
          rect: { x: 900, y: 0 },
          z: 1,
          data: { templateId: template.id, values: {} },
        }),
        id: 'card',
      },
      {
        ...createItem({ boardId, preset: 'card', rect: { x: 1500, y: 0 }, z: 1, data: { values: {} } }),
        id: 'blank',
      },
    ]);
    const item = (id: string) => {
      const element = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
      if (!element) throw new Error(`missing ${id}`);
      return element;
    };

    fireEvent.contextMenu(item('a'));
    await user.click(await screen.findByRole('menuitem', { name: /Send to back/ }));
    expect(
      changes()
        .at(-1)
        ?.upsertNodes?.find((entry) => entry.id === 'a')?.z,
    ).toBeLessThan(3);

    fireEvent.contextMenu(item('a'));
    await user.click(await screen.findByRole('menuitem', { name: 'Detach' }));
    await waitFor(() => {
      expect(node('a')?.data['dock']).toBeNull();
    });

    fireEvent.contextMenu(item('card'));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit card template' }));
    const dialog = await screen.findByRole('dialog', { name: 'Card template' });
    expect(within(dialog).getByRole('textbox', { name: 'Template name' })).toHaveValue('Hero');
    await user.click(first(within(dialog).getAllByRole('button', { name: 'Close' })));

    fireEvent.contextMenu(item('blank'));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit card template' }));
    const fresh = await screen.findByRole('dialog', { name: 'Card template' });
    expect(within(fresh).getByRole('button', { name: 'Quest' })).toBeInTheDocument();
  });

  it('reverses and deletes arrows and ignores drags and empty space', async () => {
    const user = userEvent.setup();
    const edge = createEdge(boardId, 'a', 'b', { sourceHandle: 'right', targetHandle: 'left' });
    const plain = createEdge(boardId, 'b', 'a', {});
    await open([sticky('a', 0, 0), sticky('b', 600, 0)], [edge, plain]);
    const host = document.querySelector('.react-flow');
    if (!host) throw new Error('missing flow');
    const arrow = document.createElement('div');
    arrow.className = 'react-flow__edge';
    arrow.setAttribute('data-id', edge.id);
    host.appendChild(arrow);

    fireEvent.contextMenu(arrow);
    await user.click(await screen.findByRole('menuitem', { name: 'Reverse direction' }));
    expect(changes().at(-1)?.upsertEdges?.[0]).toMatchObject({
      sourceId: 'b',
      targetId: 'a',
      data: { sourceHandle: 'left', targetHandle: 'right' },
    });

    arrow.setAttribute('data-id', plain.id);
    fireEvent.contextMenu(arrow);
    await user.click(await screen.findByRole('menuitem', { name: 'Reverse direction' }));
    expect(changes().at(-1)?.upsertEdges?.[0]).toMatchObject({
      sourceId: 'a',
      targetId: 'b',
      data: { sourceHandle: null, targetHandle: null },
    });
    arrow.setAttribute('data-id', edge.id);
    fireEvent.contextMenu(arrow);
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    expect(changes().at(-1)?.removeEdgeIds).toEqual([edge.id]);

    fireEvent.pointerDown(arrow, { button: 2, clientX: 0, clientY: 0 });
    fireEvent.contextMenu(arrow, { clientX: 50, clientY: 50 });
    expect(screen.queryByRole('menu', { name: 'Item actions' })).not.toBeInTheDocument();
    fireEvent.contextMenu(host);
    expect(screen.queryByRole('menu', { name: 'Item actions' })).not.toBeInTheDocument();
    arrow.remove();
  });
});

describe('board area', () => {
  it('shows the minimap and hides the grid from state', async () => {
    await open([sticky('a', 0, 0)], [], { minimap: true, grid: false, snap: true });
    const pane = document.createElement('div');
    pane.classList.add('react-flow__pane');
    act(() => {
      props().onDoubleClick?.(at(pane, 37, 41));
    });
    const placed = changes().at(-1)?.upsertNodes?.[0];
    expect(placed?.x).toBe(Math.round(placed?.x ?? 0));
    expect(document.querySelector('.react-flow__background')).toBeNull();
    expect(document.querySelector('.react-flow__minimap')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Minimap' }));
    expect(latest['minimap']).toBe(false);
  });
});

function first(items: HTMLElement[]): HTMLElement {
  const [item] = items;
  if (!item) throw new Error('missing element');
  return item;
}
