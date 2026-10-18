import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from '@xyflow/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardActionsContext } from '@renderer/components/editors/Board/BoardContext';
import { TemplateEditorDialog } from '@renderer/components/editors/Board/cards/TemplateEditorDialog';
import { CardItem } from '@renderer/components/editors/Board/items/CardItem';
import { ImageItem } from '@renderer/components/editors/Board/items/ImageItem';
import { createItem } from '@renderer/lib/board';
import { createCardTemplate } from '@renderer/lib/cards';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function first(items: HTMLElement[]): HTMLElement {
  const [item] = items;
  if (!item) throw new Error('missing element');
  return item;
}

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.projects = [project];
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

describe('card template editor', () => {
  it('starts from a starter, edits fields and card settings, and saves a new template', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <Providers>
        <TemplateEditorDialog open templateId={null} onOpenChange={vi.fn()} onSaved={onSaved} />
      </Providers>,
    );
    await user.click(await screen.findByRole('button', { name: 'Quest' }));
    const fields = screen.getByRole('complementary', { name: 'Fields' });
    expect(within(fields).getByRole('button', { name: 'Edit Title' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add field' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Stat bar' }));
    const settings = screen.getByRole('complementary', { name: 'Field' });
    const label = within(settings).getByRole('textbox', { name: 'Label' });
    await user.clear(label);
    await user.type(label, 'Difficulty');
    expect(within(fields).getByRole('button', { name: 'Edit Difficulty' })).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Difficulty' })).toBeInTheDocument();

    await user.click(within(fields).getByRole('button', { name: 'Duplicate Difficulty' }));
    await user.click(first(within(fields).getAllByRole('button', { name: 'Remove Difficulty' }).slice(1)));
    await user.click(within(fields).getByRole('button', { name: 'Remove Completed' }));

    await user.click(screen.getByRole('button', { name: 'Card' }));
    const card = screen.getByRole('complementary', { name: 'Card' });
    const width = within(card).getByLabelText('Width');
    await user.clear(width);
    await user.type(width, '400{Enter}');
    await user.click(screen.getByRole('button', { name: 'Save template' }));

    expect(api.createCardTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Quest', width: 400 }) as object,
    );
    const saved = vi.mocked(api.createCardTemplate).mock.calls[0]?.[0];
    expect(saved?.fields?.map((field) => field.label)).toEqual([
      'Title',
      'Given by',
      'Level',
      'Goal',
      'Rewards',
      'Difficulty',
    ]);
    expect(onSaved).toHaveBeenCalled();
    expect(await screen.findByText('Template "Quest" saved.')).toBeInTheDocument();
  });

  it('edits, duplicates and deletes an existing template', async () => {
    const user = userEvent.setup();
    const template = await createCardTemplate({
      name: 'Item',
      fields: [{ id: 'name', kind: 'heading', label: 'Name' }],
    });
    render(
      <Providers>
        <TemplateEditorDialog open templateId={template.id} onOpenChange={vi.fn()} />
      </Providers>,
    );
    const name = await screen.findByRole('textbox', { name: 'Template name' });
    await user.clear(name);
    await user.type(name, 'Loot');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.getByRole('textbox', { name: 'Template name' })).toHaveValue('Item');
    await user.clear(screen.getByRole('textbox', { name: 'Template name' }));
    await user.type(screen.getByRole('textbox', { name: 'Template name' }), 'Loot');
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    expect(api.updateCardTemplate).toHaveBeenCalledWith(
      template.id,
      expect.objectContaining({ name: 'Loot' }) as object,
    );

    await user.click(screen.getByRole('button', { name: 'Duplicate template' }));
    expect(await screen.findByRole('textbox', { name: 'Template name' })).toHaveValue('Loot copy');
    await user.click(screen.getByRole('button', { name: 'Delete template' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(api.deleteCardTemplate).toHaveBeenCalled();
  });
});

describe('card and image items', () => {
  it('renders a card from its template and writes edited values back', async () => {
    const user = userEvent.setup();
    const updateNode = vi.fn();
    const template = await createCardTemplate({
      name: 'Hero',
      fields: [
        { id: 'name', kind: 'heading', label: 'Name' },
        { id: 'rarity', kind: 'select', label: 'Rarity', options: ['Common', 'Rare'] },
        { id: 'hp', kind: 'stat', label: 'HP', min: 0, max: 10, defaultValue: 4 },
        { id: 'ready', kind: 'checkbox', label: 'Ready' },
        { id: 'tags', kind: 'tags', label: 'Tags' },
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
        data: expect.objectContaining({ values: expect.objectContaining({ tags: [] }) as object }) as object,
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
