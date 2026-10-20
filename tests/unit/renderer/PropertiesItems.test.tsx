import { act, render, renderHook, screen } from '@testing-library/react';
import { useWorkspaces } from '@renderer/lib/workspaces';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardChanges } from '@shared/board';
import { PropertiesEditor } from '@renderer/components/editors/Properties/PropertiesEditor';
import {
  commitChanges,
  createBoard,
  createEdge,
  createItem,
  loadBoard,
  setActiveBoard,
  setBoardSelection,
} from '@renderer/lib/board';
import { createCardTemplate } from '@renderer/lib/cards';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function first(items: HTMLElement[]): HTMLElement {
  const [item] = items;
  if (!item) throw new Error('missing element');
  return item;
}

function Harness() {
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <PropertiesEditor areaId="p" state={{}} setState={() => undefined} />
      </ToastProvider>
    </TooltipProvider>
  );
}

async function openBoard() {
  const board = await createBoard({ name: 'Ideas' });
  await loadBoard(board.id);
  setActiveBoard(board.id);
  return board;
}

function lastChange(): BoardChanges {
  const calls = vi.mocked(api.applyBoardChanges).mock.calls;
  return calls[calls.length - 1]?.[1] ?? {};
}

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

describe('item properties', () => {
  it('edits the shared style, name and lock of an item', async () => {
    const user = userEvent.setup();
    const board = await openBoard();
    const shape = {
      ...createItem({ boardId: board.id, preset: 'rectangle', rect: { x: 0, y: 0 }, z: 1 }),
      id: 's',
    };
    await commitChanges(board.id, { upsertNodes: [shape] });
    setBoardSelection(board.id, ['s']);
    render(<Harness />);

    await user.click(await screen.findByRole('combobox', { name: 'Shape' }));
    await user.click(await screen.findByRole('option', { name: 'Diamond' }));
    expect(lastChange().upsertNodes?.[0]?.data['style']).toMatchObject({ shape: 'diamond' });

    const radius = screen.getByLabelText('Corner radius');
    await user.clear(radius);
    await user.type(radius, '14{Enter}');
    expect(lastChange().upsertNodes?.[0]?.data['style']).toMatchObject({ radius: 14 });

    await user.click(first(screen.getAllByRole('button', { name: 'None' })));
    expect(lastChange().upsertNodes?.[0]?.data['style']).toMatchObject({ fill: null });
    await user.click(first(screen.getAllByRole('button', { name: 'Default' })));
    expect(lastChange().upsertNodes?.[0]?.data['style']).not.toHaveProperty('fill');

    await user.click(screen.getByRole('switch', { name: 'Shadow' }));
    expect(lastChange().upsertNodes?.[0]?.data['style']).toMatchObject({ shadow: true });
    await user.click(screen.getByRole('radio', { name: 'Bottom' }));
    expect(lastChange().upsertNodes?.[0]?.data['style']).toMatchObject({ verticalAlign: 'bottom' });
    await user.click(screen.getByRole('radio', { name: 'Right' }));
    expect(lastChange().upsertNodes?.[0]?.data['style']).toMatchObject({ align: 'right' });

    const name = screen.getByRole('textbox', { name: 'Item name' });
    await user.type(name, 'Gate');
    await user.tab();
    expect(lastChange().upsertNodes?.[0]?.data).toMatchObject({ name: 'Gate' });
    await user.click(screen.getByRole('switch', { name: 'Locked' }));
    expect(lastChange().upsertNodes?.[0]?.data).toMatchObject({ locked: true });
  });

  it('edits container, image and card sections', async () => {
    const user = userEvent.setup();
    const board = await openBoard();
    const template = await createCardTemplate({
      name: 'Hero',
      fields: [{ id: 'name', kind: 'text', label: 'Name' }],
    });
    const frame = {
      ...createItem({ boardId: board.id, preset: 'container', rect: { x: 0, y: 0 }, z: 1 }),
      id: 'f',
    };
    const image = {
      ...createItem({ boardId: board.id, preset: 'image', rect: { x: 0, y: 0 }, z: 2 }),
      id: 'i',
    };
    const card = {
      ...createItem({ boardId: board.id, preset: 'card', rect: { x: 0, y: 0 }, z: 3 }),
      id: 'c',
    };
    await commitChanges(board.id, { upsertNodes: [frame, image, card] });

    setBoardSelection(board.id, ['f']);
    const view = render(<Harness />);
    const title = await screen.findByRole('textbox', { name: 'Title' });
    await user.type(title, 'Level 1');
    await user.tab();
    expect(lastChange().upsertNodes?.[0]?.data).toMatchObject({ title: 'Level 1' });
    await user.click(screen.getByRole('switch', { name: 'Show title' }));
    expect(lastChange().upsertNodes?.[0]?.data).toMatchObject({ showTitle: false });

    act(() => {
      setBoardSelection(board.id, ['i']);
    });
    await user.click(await screen.findByRole('combobox', { name: 'Fit' }));
    await user.click(await screen.findByRole('option', { name: 'Cover' }));
    expect(lastChange().upsertNodes?.[0]?.data).toMatchObject({ fit: 'cover' });
    const alt = screen.getByRole('textbox', { name: 'Description' });
    await user.type(alt, 'Map');
    await user.tab();
    expect(lastChange().upsertNodes?.[0]?.data).toMatchObject({ alt: 'Map' });
    expect(screen.queryByText('Text style')).not.toBeInTheDocument();

    act(() => {
      setBoardSelection(board.id, ['c']);
    });
    await user.click(await screen.findByRole('combobox', { name: 'Template' }));
    await user.click(await screen.findByRole('option', { name: 'Hero' }));
    expect(lastChange().upsertNodes?.[0]?.data).toMatchObject({ templateId: template.id });
    const value = await screen.findByRole('textbox', { name: 'Name' });
    await user.type(value, 'Ignis{Enter}');
    expect(lastChange().upsertNodes?.[0]?.data).toMatchObject({ values: { name: 'Ignis' } });
    await user.click(screen.getByRole('button', { name: 'Edit template' }));
    expect(JSON.stringify(renderHook(() => useWorkspaces()).result.current)).toContain(
      `"target":{"kind":"template","id":"${template.id}"}`,
    );
    view.unmount();
  });

  it('edits an arrow and reverses it', async () => {
    const user = userEvent.setup();
    const board = await openBoard();
    const a = { ...createItem({ boardId: board.id, preset: 'text', rect: { x: 0, y: 0 }, z: 1 }), id: 'a' };
    const b = { ...createItem({ boardId: board.id, preset: 'text', rect: { x: 400, y: 0 }, z: 2 }), id: 'b' };
    const edge = {
      ...createEdge(board.id, 'a', 'b', { sourceHandle: 'right', targetHandle: 'left' }),
      id: 'e',
    };
    await commitChanges(board.id, { upsertNodes: [a, b], upsertEdges: [edge] });
    setBoardSelection(board.id, [], ['e']);
    render(<Harness />);

    const label = await screen.findByRole('textbox', { name: 'Label' });
    await user.type(label, 'leads to');
    await user.tab();
    expect(lastChange().upsertEdges?.[0]?.data).toMatchObject({ label: 'leads to' });
    await user.click(screen.getByRole('combobox', { name: 'Path' }));
    await user.click(await screen.findByRole('option', { name: 'Stepped' }));
    expect(lastChange().upsertEdges?.[0]?.data).toMatchObject({ path: 'step' });
    await user.click(screen.getByRole('combobox', { name: 'Start' }));
    await user.click(await screen.findByRole('option', { name: 'Dot' }));
    expect(lastChange().upsertEdges?.[0]?.data).toMatchObject({ startMarker: 'circle' });
    await user.click(screen.getByRole('combobox', { name: 'Line' }));
    await user.click(await screen.findByRole('option', { name: 'Dashed' }));
    await user.click(screen.getByRole('switch', { name: 'Animated' }));
    expect(lastChange().upsertEdges?.[0]?.data).toMatchObject({ animated: true });
    const width = screen.getByLabelText('Width');
    await user.clear(width);
    await user.type(width, '4{Enter}');
    expect(lastChange().upsertEdges?.[0]?.data).toMatchObject({ width: 4 });
    await user.click(screen.getByRole('button', { name: 'Reverse direction' }));
    expect(lastChange().upsertEdges?.[0]).toMatchObject({
      sourceId: 'b',
      targetId: 'a',
      data: { sourceHandle: 'left', targetHandle: 'right' },
    });
  });
});
