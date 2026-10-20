import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from '@xyflow/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardActionsContext } from '@renderer/components/editors/Board/BoardContext';
import { CardItem } from '@renderer/components/editors/Board/items/CardItem';
import { ImageItem } from '@renderer/components/editors/Board/items/ImageItem';
import { createItem } from '@renderer/lib/board';
import { createCardTemplate } from '@renderer/lib/cards';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

function Providers({
  children,
  updateNode = vi.fn(),
}: {
  children: React.ReactNode;
  updateNode?: () => void;
}) {
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <ReactFlowProvider>
          <BoardActionsContext
            value={{
              boardId: 'b',
              textColour: '#1a1a1a',
              editingId: null,
              setEditingId: vi.fn(),
              updateNode,
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
            }}
          >
            {children}
          </BoardActionsContext>
        </ReactFlowProvider>
      </ToastProvider>
    </TooltipProvider>
  );
}

const nodeProps = {
  type: 'card',
  selected: false,
  dragging: false,
  zIndex: 1,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  deletable: true,
  selectable: true,
  draggable: true,
};

describe('card and image items', () => {
  it('renders a card from its template and writes edited values back', async () => {
    const user = userEvent.setup();
    const updateNode = vi.fn();
    const template = await createCardTemplate({
      name: 'Hero',
      fields: [
        { id: 'name', kind: 'text', label: 'Name' },
        { id: 'rarity', kind: 'choice', label: 'Rarity', options: ['Common', 'Rare'] },
        { id: 'hp', kind: 'number', display: 'bar', label: 'HP', min: 0, max: 10, defaultValue: 4 },
        { id: 'ready', kind: 'checkbox', label: 'Ready' },
        { id: 'tags', kind: 'choice', multiple: true, allowNew: true, label: 'Tags' },
      ],
    });
    const node = createItem({
      boardId: 'b',
      preset: 'card',
      rect: { x: 0, y: 0 },
      z: 1,
      data: { templateId: template.id, values: { tags: ['Fire'] } },
    });
    render(
      <Providers updateNode={updateNode}>
        <CardItem id={node.id} {...nodeProps} data={{ node }} />
      </Providers>,
    );
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.type(name, 'Ignis{Enter}');
    expect(updateNode).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          values: expect.objectContaining({ name: 'Ignis' }) as object,
        }) as object,
      }) as object,
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rarity' }), 'Rare');
    expect(updateNode).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          values: expect.objectContaining({ rarity: 'Rare' }) as object,
        }) as object,
      }) as object,
    );
    expect(screen.getByRole('meter', { name: 'HP' })).toHaveAttribute('aria-valuenow', '4');
    await user.click(screen.getByRole('checkbox', { name: 'Ready' }));
    await user.click(screen.getByRole('button', { name: 'Remove Fire' }));
    expect(updateNode).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          values: expect.objectContaining({ tags: null }) as object,
        }) as object,
      }) as object,
    );
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Tags: Add a tag…' }), { key: 'Enter' });
  });

  it('shows a fallback for a card without a template and an image placeholder', () => {
    const card = createItem({
      boardId: 'b',
      preset: 'card',
      rect: { x: 0, y: 0 },
      z: 1,
      data: { templateId: 'gone', values: { a: 'Kept' } },
    });
    const image = createItem({ boardId: 'b', preset: 'image', rect: { x: 0, y: 0 }, z: 1 });
    const picture = createItem({
      boardId: 'b',
      preset: 'image',
      rect: { x: 0, y: 0 },
      z: 1,
      data: { assetId: 'a b', alt: 'Map' },
    });
    render(
      <Providers>
        <CardItem id={card.id} {...nodeProps} data={{ node: card }} />
        <ImageItem id={image.id} {...nodeProps} type="image" data={{ node: image }} />
        <ImageItem id={picture.id} {...nodeProps} type="image" data={{ node: picture }} />
      </Providers>,
    );
    expect(screen.getByText("This card's template was deleted")).toBeInTheDocument();
    expect(screen.getByText('Kept')).toBeInTheDocument();
    expect(screen.getByText('No image chosen')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Map' })).toHaveAttribute('src', 'loopy-asset://asset/a%20b');
  });
});
