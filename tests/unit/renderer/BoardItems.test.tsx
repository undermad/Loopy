import type { ComponentType } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Position, ReactFlowProvider, type NodeProps } from '@xyflow/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardEdge, BoardNode } from '@shared/board';
import { ArrowEdge } from '@renderer/components/editors/Board/ArrowEdge';
import { BoardActionsContext, type BoardActions } from '@renderer/components/editors/Board/BoardContext';
import { CardItem } from '@renderer/components/editors/Board/items/CardItem';
import { ContainerItem } from '@renderer/components/editors/Board/items/ContainerItem';
import { FileItem } from '@renderer/components/editors/Board/items/FileItem';
import type { ItemFlowNode } from '@renderer/components/editors/Board/items/TextItem';
import { TextItem } from '@renderer/components/editors/Board/items/TextItem';
import { importFiles } from '@renderer/lib/assets';
import { createEdge, createItem } from '@renderer/lib/board';
import { createCardTemplate } from '@renderer/lib/cards';
import { TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject } from './helpers/api';

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
    ...overrides,
  };
}

function renderItem(
  Item: ComponentType<NodeProps<ItemFlowNode>>,
  node: BoardNode,
  value: BoardActions,
  selected = false,
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

function renderArrow(
  edge: BoardEdge,
  value: BoardActions,
  extra: { selected?: boolean; vertical?: boolean } = {},
) {
  return render(
    <ReactFlowProvider>
      <BoardActionsContext value={value}>
        <svg>
          <ArrowEdge
            id={edge.id}
            source={edge.sourceId}
            target={edge.targetId}
            sourceX={0}
            sourceY={0}
            targetX={200}
            targetY={120}
            sourcePosition={extra.vertical ? Position.Bottom : Position.Right}
            targetPosition={extra.vertical ? Position.Top : Position.Left}
            selected={extra.selected ?? false}
            data={{ edge }}
          />
        </svg>
      </BoardActionsContext>
    </ReactFlowProvider>,
  );
}

beforeEach(async () => {
  const api = await bootTestApp();
  const project = makeProject('Items');
  api.projects = [project];
  api.current = project;
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

describe('arrow edge', () => {
  it('draws each path, dash and marker style', () => {
    const base = createEdge('b', 'a', 'c');
    const { container, unmount } = renderArrow(base, actions());
    expect(container.querySelectorAll('marker')).toHaveLength(1);
    expect(container.querySelector('path[marker-end]')).not.toBeNull();
    unmount();

    const styled = {
      ...base,
      data: {
        path: 'straight',
        dash: 'dashed',
        startMarker: 'arrow',
        endMarker: 'circle',
        colour: { hex: '#ff0000', ref: null },
      },
    };
    const straight = renderArrow(styled, actions(), { selected: true, vertical: true });
    expect(straight.container.querySelectorAll('marker')).toHaveLength(2);
    expect(straight.container.querySelector('marker circle')).not.toBeNull();
    straight.unmount();

    for (const path of ['step', 'smoothstep']) {
      const view = renderArrow(
        { ...base, data: { path, dash: 'dotted', animated: true, endMarker: 'none', label: 'Go' } },
        actions({ editingId: base.id }),
      );
      expect(view.container.querySelectorAll('marker')).toHaveLength(0);
      view.unmount();
    }
  });
});

describe('file item', () => {
  it('shows media players, file details and a missing file', async () => {
    const { ids } = await act(() =>
      importFiles(
        [
          new File(['a'], 'theme.mp3', { type: 'audio/mpeg' }),
          new File(['v'], 'intro.mp4', { type: 'video/mp4' }),
          new File(['t'], 'notes.txt', { type: 'text/plain' }),
        ],
        'auto',
      ),
    );
    const file = (assetId: string | null) => ({
      ...createItem({ boardId: 'b', preset: 'file', rect: { x: 0, y: 0 }, z: 1, data: { assetId } }),
      id: assetId ?? 'none',
    });

    const audio = renderItem(FileItem, file(ids[0] ?? null), actions());
    expect(screen.getByText('theme.mp3')).toBeInTheDocument();
    expect(audio.container.querySelector('audio')).not.toBeNull();
    audio.unmount();
    const video = renderItem(FileItem, file(ids[1] ?? null), actions(), true);
    expect(video.container.querySelector('video')).not.toBeNull();
    video.unmount();
    const other = renderItem(FileItem, file(ids[2] ?? null), actions());
    expect(screen.getByText('notes.txt')).toBeInTheDocument();
    other.unmount();
    renderItem(FileItem, file(null), actions());
    expect(screen.getByText('File not found')).toBeInTheDocument();
  });
});

describe('container item', () => {
  const room = {
    ...createItem({ boardId: 'b', preset: 'container', rect: { x: 0, y: 0 }, z: 1, data: { title: 'Room' } }),
    id: 'room',
  };

  it('shows where a drop will land', () => {
    const move = renderItem(ContainerItem, room, actions({ dropTarget: { id: 'room', kind: 'move' } }));
    expect(screen.getByText('Move into Room')).toBeInTheDocument();
    move.unmount();
    const add = renderItem(ContainerItem, room, actions({ dropTarget: { id: 'room', kind: 'add' } }));
    expect(screen.getByText('Add to Room')).toBeInTheDocument();
    add.unmount();
    renderItem(ContainerItem, room, actions({ dropTarget: { id: 'room', kind: 'stay' } }));
    expect(screen.queryByText(/into Room/)).not.toBeInTheDocument();
  });

  it('renames from the title and ignores a locked or hidden title', () => {
    const value = actions();
    const view = renderItem(ContainerItem, room, value);
    fireEvent.doubleClick(screen.getByText('Room'));
    const input = screen.getByRole('textbox', { name: 'Title' });
    fireEvent.change(input, { target: { value: 'Hall' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(value.updateNode).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: 'Hall' }) as unknown }),
    );
    view.unmount();

    const editing = actions({ editingId: 'room' });
    const opened = renderItem(ContainerItem, room, editing);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Title' }), { key: 'Escape' });
    expect(editing.setEditingId).toHaveBeenCalledWith(null);
    opened.unmount();

    renderItem(ContainerItem, { ...room, data: { ...room.data, locked: true } }, actions());
    fireEvent.doubleClick(screen.getByText('Room'));
    expect(screen.queryByRole('textbox', { name: 'Title' })).not.toBeInTheDocument();
  });

  it('hides its title and outlines docked peers', () => {
    const { container } = renderItem(
      ContainerItem,
      { ...room, data: { ...room.data, showTitle: false } },
      actions({ dockedPeers: new Set(['room']) }),
    );
    expect(screen.queryByText('Room')).not.toBeInTheDocument();
    expect(container.querySelector('[class*="dockedPeer"]')).not.toBeNull();
  });
});

describe('text and card items', () => {
  it('starts editing with Enter unless locked and saves on Escape', () => {
    const note = {
      ...createItem({ boardId: 'b', preset: 'sticky', rect: { x: 0, y: 0 }, z: 1, data: { text: 'Hi' } }),
      id: 'note',
    };
    const value = actions();
    const view = renderItem(TextItem, note, value);
    fireEvent.keyDown(screen.getByRole('group', { name: 'Hi' }), { key: 'Enter' });
    const area = screen.getByRole('textbox', { name: 'Text' });
    fireEvent.change(area, { target: { value: 'Hello' } });
    fireEvent.keyDown(area, { key: 'Escape' });
    expect(value.updateNode).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ text: 'Hello' }) as unknown }),
    );
    view.unmount();

    renderItem(TextItem, { ...note, data: { ...note.data, locked: true } }, actions());
    fireEvent.keyDown(screen.getByRole('group', { name: 'Hi' }), { key: 'Enter' });
    expect(screen.queryByRole('textbox', { name: 'Text' })).not.toBeInTheDocument();
  });

  it('keeps card inputs inert until the card is selected', async () => {
    const template = await createCardTemplate({
      name: 'Hero',
      fields: [{ id: 'name', kind: 'text', label: 'Name' }],
    });
    const card = {
      ...createItem({
        boardId: 'b',
        preset: 'card',
        rect: { x: 0, y: 0 },
        z: 1,
        data: { templateId: template.id },
      }),
      id: 'card',
    };
    const idle = renderItem(CardItem, card, actions());
    expect(idle.container.querySelector('[class*="cardInert"]')).not.toBeNull();
    idle.unmount();
    const active = renderItem(CardItem, card, actions(), true);
    expect(active.container.querySelector('[class*="cardInert"]')).toBeNull();
    active.unmount();
    renderItem(CardItem, { ...card, data: { templateId: 'gone', values: { name: 'Old' } } }, actions());
    expect(screen.getByText("This card's template was deleted")).toBeInTheDocument();
    expect(screen.getByText('Old')).toBeInTheDocument();
  });
});
