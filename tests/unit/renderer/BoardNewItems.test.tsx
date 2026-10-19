import type { ComponentType } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider, type NodeProps } from '@xyflow/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardNode } from '@shared/board';
import { BoardActionsContext, type BoardActions } from '@renderer/components/editors/Board/BoardContext';
import { ChecklistItem } from '@renderer/components/editors/Board/items/ChecklistItem';
import { EmbedItem } from '@renderer/components/editors/Board/items/EmbedItem';
import { IconItem } from '@renderer/components/editors/Board/items/IconItem';
import { TableItem } from '@renderer/components/editors/Board/items/TableItem';
import type { ItemFlowNode } from '@renderer/components/editors/Board/items/TextItem';
import { NodeProperties } from '@renderer/components/editors/Properties/NodeProperties';
import { commitChanges, createBoard, createItem, loadBoard, useBoardSnapshot } from '@renderer/lib/board';
import { createCardTemplate, createSavedCard } from '@renderer/lib/cards';
import { createNote } from '@renderer/lib/notes';
import { createPalette } from '@renderer/lib/palettes';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function actions(overrides: Partial<BoardActions> = {}): BoardActions {
  return {
    boardId: 'b',
    textColour: '#111111',
    editingId: null,
    setEditingId: vi.fn(),
    updateNode: vi.fn(),
    updateEdge: vi.fn(),
    openTemplateEditor: vi.fn(),
    dropTarget: null,
    dockedPeers: new Set(),
    wholeGroup: new Set(),
    snapping: false,
    keepRatio: false,
    previewRotation: vi.fn(),
    rotateItem: vi.fn(),
    previewGeometry: vi.fn(),
    setTransforming: vi.fn(),
    gridStep: () => 10,
    openLink: vi.fn(),
    ...overrides,
  };
}

function renderItem(
  Item: ComponentType<NodeProps<ItemFlowNode>>,
  node: BoardNode,
  value: BoardActions,
  selected = true,
) {
  return render(
    <TooltipProvider>
      <ReactFlowProvider>
        <BoardActionsContext value={value}>
          <Item
            id={node.id}
            type={node.type}
            selected={selected}
            dragging={false}
            zIndex={1}
            isConnectable
            positionAbsoluteX={0}
            positionAbsoluteY={0}
            deletable
            selectable
            draggable
            width={node.width}
            height={node.height}
            data={{ node }}
          />
        </BoardActionsContext>
      </ReactFlowProvider>
    </TooltipProvider>,
  );
}

const item = (preset: 'icon' | 'checklist' | 'table' | 'embed', data: Record<string, unknown> = {}) =>
  createItem({ boardId: 'b', preset, rect: { x: 0, y: 0 }, z: 1, data });

function updated(value: BoardActions): BoardNode | undefined {
  return vi.mocked(value.updateNode).mock.lastCall?.[0];
}

beforeEach(async () => {
  api = await bootTestApp();
  api.current = makeProject('Space Game');
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

describe('icon item', () => {
  it('draws the chosen game icon', () => {
    renderItem(IconItem, item('icon', { icon: 'sword' }), actions());
    expect(screen.getByRole('img', { name: 'Sword' })).toBeInTheDocument();
  });
});

describe('checklist item', () => {
  it('ticks and adds steps and shows progress', async () => {
    const user = userEvent.setup();
    const value = actions();
    const node = item('checklist', {
      title: 'Quest',
      items: [
        { id: 's1', text: 'Find key', done: true },
        { id: 's2', text: 'Open door', done: false },
      ],
    });
    renderItem(ChecklistItem, node, value);
    expect(screen.getByText('Quest')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Open door' }));
    expect(updated(value)?.data['items']).toEqual([
      { id: 's1', text: 'Find key', done: true },
      { id: 's2', text: 'Open door', done: true },
    ]);
    await user.type(screen.getByRole('textbox', { name: 'Add a step' }), 'Leave{Enter}');
    expect(updated(value)?.data['items']).toHaveLength(3);
  });

  it('only reads while locked', () => {
    renderItem(
      ChecklistItem,
      item('checklist', { locked: true, items: [{ id: 's', text: 'A', done: false }] }),
      actions(),
    );
    expect(screen.getByRole('checkbox', { name: 'A' })).toBeDisabled();
    expect(screen.queryByRole('textbox', { name: 'Add a step' })).not.toBeInTheDocument();
  });
});

describe('table item', () => {
  it('shows a header row and edits a cell while selected', () => {
    const value = actions();
    const node = item('table', {
      rows: [
        ['Name', 'HP'],
        ['Slime', '5'],
      ],
    });
    const { unmount } = renderItem(TableItem, node, value);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    const cell = screen.getByRole('textbox', { name: 'Row 2, column 2' });
    fireEvent.change(cell, { target: { value: '8' } });
    fireEvent.blur(cell);
    expect(updated(value)?.data['rows']).toEqual([
      ['Name', 'HP'],
      ['Slime', '8'],
    ]);
    unmount();
    renderItem(TableItem, { ...node, data: { ...node.data, header: false } }, actions(), false);
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Slime' })).toBeInTheDocument();
  });
});

describe('embed item', () => {
  it('shows a live preview of a note, palette or card and opens it', async () => {
    const user = userEvent.setup();
    const note = await act(() =>
      createNote({ title: 'Lore', body: '# Dragons\nThey fly over the **sea**.' }),
    );
    const value = actions();
    const { unmount } = renderItem(
      EmbedItem,
      item('embed', { target: { kind: 'note', id: note.id } }),
      value,
    );
    expect(screen.getByText('Lore')).toBeInTheDocument();
    expect(screen.getByText(/They fly over the sea/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open Lore' }));
    expect(value.openLink).toHaveBeenCalledWith({ kind: 'note', id: note.id });
    unmount();

    const palette = await act(() =>
      createPalette({ name: 'Forest', colours: [{ hex: '#228833' }, { hex: '#88cc44' }] }),
    );
    const second = renderItem(
      EmbedItem,
      item('embed', { target: { kind: 'palette', id: palette.id } }),
      actions(),
    );
    expect(second.container.querySelectorAll('[data-swatch]')).toHaveLength(2);
    second.unmount();

    const template = await act(() =>
      createCardTemplate({ name: 'Hero', fields: [{ id: 'name', kind: 'text', label: 'Name' }] }),
    );
    const card = await act(() =>
      createSavedCard({ name: 'Knight', templateId: template.id, values: { name: 'Sir Ada' } }),
    );
    const third = renderItem(EmbedItem, item('embed', { target: { kind: 'card', id: card.id } }), actions());
    expect(screen.getByText('Sir Ada')).toBeInTheDocument();
    third.unmount();

    renderItem(EmbedItem, item('embed'), actions());
    expect(screen.getByText('Pick something to show')).toBeInTheDocument();
  });
});

describe('new item properties', () => {
  function Live({ boardId, id }: { boardId: string; id: string }) {
    const snapshot = useBoardSnapshot(boardId);
    const node = snapshot?.nodes.find((candidate) => candidate.id === id);
    if (!snapshot || !node) return null;
    return <NodeProperties board={snapshot.board} node={node} nodes={snapshot.nodes} />;
  }

  async function show(preset: 'icon' | 'checklist' | 'table' | 'embed') {
    const board = await createBoard({ name: 'Ideas', unit: 'px' });
    await loadBoard(board.id);
    const node = createItem({ boardId: board.id, preset, rect: { x: 0, y: 0 }, z: 1 });
    await commitChanges(board.id, { upsertNodes: [node] }, { history: false });
    render(
      <TooltipProvider>
        <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
          <Live boardId={board.id} id={node.id} />
        </ToastProvider>
      </TooltipProvider>,
    );
    return node;
  }

  function lastData(): Record<string, unknown> | undefined {
    return vi.mocked(api.applyBoardChanges).mock.lastCall?.[1].upsertNodes?.[0]?.data;
  }

  async function pick(user: ReturnType<typeof userEvent.setup>, name: string, option: string) {
    await user.click(screen.getByRole('combobox', { name }));
    await user.click(await screen.findByRole('option', { name: option }));
  }

  it('picks an icon', async () => {
    const user = userEvent.setup();
    await show('icon');
    await pick(user, 'Icon', 'Sword');
    expect(lastData()).toMatchObject({ icon: 'sword' });
  });

  it('sets a checklist title and progress', async () => {
    const user = userEvent.setup();
    await show('checklist');
    const title = screen.getByRole('textbox', { name: 'Title' });
    fireEvent.change(title, { target: { value: 'Chores' } });
    fireEvent.blur(title);
    expect(lastData()).toMatchObject({ title: 'Chores' });
    await user.click(screen.getByRole('switch', { name: 'Show progress' }));
    expect(lastData()).toMatchObject({ showProgress: false });
  });

  it('resizes a table and toggles its header', async () => {
    const user = userEvent.setup();
    await show('table');
    const rows = screen.getByRole('spinbutton', { name: 'Rows' });
    fireEvent.change(rows, { target: { value: '4' } });
    fireEvent.blur(rows);
    expect((lastData()?.['rows'] as string[][] | undefined)?.length).toBe(4);
    const columns = screen.getByRole('spinbutton', { name: 'Columns' });
    fireEvent.change(columns, { target: { value: '2' } });
    fireEvent.blur(columns);
    expect((lastData()?.['rows'] as string[][] | undefined)?.[0]?.length).toBe(2);
    await user.click(screen.getByRole('switch', { name: 'Header row' }));
    expect(lastData()).toMatchObject({ header: false });
  });

  it('chooses what an embed shows', async () => {
    const user = userEvent.setup();
    const note = await act(() => createNote({ title: 'Lore', body: '' }));
    await show('embed');
    await pick(user, 'Shows', 'Note: Lore');
    expect(lastData()).toMatchObject({ target: { kind: 'note', id: note.id } });
  });
});
