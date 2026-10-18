import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardChanges, BoardNode } from '@shared/board';
import { LayersEditor } from '@renderer/components/editors/Layers/LayersEditor';
import { PropertiesEditor } from '@renderer/components/editors/Properties/PropertiesEditor';
import { importFiles } from '@renderer/lib/assets';
import {
  commitChanges,
  createBoard,
  createItem,
  getBoardNodes,
  loadBoard,
  setActiveBoard,
  setBoardSelection,
  useBoardSelection,
} from '@renderer/lib/board';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function Selection() {
  const selection = useBoardSelection();
  return <output aria-label="selection">{selection?.nodeIds.join(',') ?? ''}</output>;
}

function Harness({ layers = false }: { layers?: boolean }) {
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        {layers ? (
          <LayersEditor areaId="l" state={{}} setState={() => undefined} />
        ) : (
          <PropertiesEditor areaId="p" state={{}} setState={() => undefined} />
        )}
        <Selection />
      </ToastProvider>
    </TooltipProvider>
  );
}

function lastChange(): BoardChanges {
  const calls = vi.mocked(api.applyBoardChanges).mock.calls;
  return calls[calls.length - 1]?.[1] ?? {};
}

async function boardWith(nodes: (boardId: string) => BoardNode[]) {
  const board = await createBoard({ name: 'Ideas' });
  await loadBoard(board.id);
  setActiveBoard(board.id);
  await commitChanges(board.id, { upsertNodes: nodes(board.id) });
  return board;
}

function item(boardId: string, id: string, x: number, extra: Partial<BoardNode> = {}): BoardNode {
  return { ...createItem({ boardId, preset: 'sticky', rect: { x, y: 0 }, z: 1 }), id, ...extra };
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

describe('layers panel', () => {
  it('lists items top first and selects, hides, locks and renames them', async () => {
    const user = userEvent.setup();
    await boardWith((boardId) => [
      {
        ...createItem({ boardId, preset: 'container', rect: { x: 0, y: 0 }, z: 1 }),
        id: 'room',
        data: { title: 'Room' },
      },
      item(boardId, 'key', 10, { parentId: 'room', data: { text: 'Key\nsecond line' }, z: 2 }),
      item(boardId, 'note', 600, { data: { text: 'Note' }, z: 3 }),
    ]);
    render(<Harness layers />);

    const list = await screen.findByRole('list', { name: 'Layers' });
    const names = within(list)
      .getAllByRole('button', { pressed: false })
      .map((button) => button.textContent);
    expect(names).toEqual(['Note', 'Room', 'Key']);

    const selection = () => screen.getByRole('status', { name: 'selection' });
    await user.click(screen.getByRole('button', { name: 'Room' }));
    expect(selection()).toHaveTextContent('room');
    await user.click(screen.getByRole('button', { name: 'Note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Room' }), { shiftKey: true });
    expect(selection()).toHaveTextContent('note,room');
    fireEvent.click(screen.getByRole('button', { name: 'Room' }), { ctrlKey: true });
    expect(selection()).toHaveTextContent('note');

    await user.click(screen.getByRole('button', { name: 'Hide Note' }));
    expect(lastChange().upsertNodes?.[0]?.data).toMatchObject({ hidden: true });
    await user.click(screen.getByRole('button', { name: 'Lock Key' }));
    expect(lastChange().upsertNodes?.[0]?.data).toMatchObject({ locked: true });

    await user.click(screen.getByRole('button', { name: 'Collapse Room' }));
    expect(screen.queryByRole('button', { name: 'Key' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand Room' }));

    await user.dblClick(screen.getByRole('button', { name: 'Note' }));
    const rename = screen.getByRole('textbox', { name: 'Layer name' });
    await user.clear(rename);
    await user.type(rename, 'Reminder{Enter}');
    expect(lastChange().upsertNodes?.[0]?.data).toMatchObject({ name: 'Reminder' });
    await user.dblClick(screen.getByRole('button', { name: 'Reminder' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox', { name: 'Layer name' })).not.toBeInTheDocument();
  });

  it('explains when there is no board or nothing on it', async () => {
    const { unmount } = render(<Harness layers />);
    expect(screen.getByText('No board open')).toBeInTheDocument();
    unmount();
    await boardWith(() => []);
    render(<Harness layers />);
    expect(screen.getByText('No items on this board yet')).toBeInTheDocument();
  });
});

describe('unified properties', () => {
  it('shows visibility, docking and layer order for one item', async () => {
    const user = userEvent.setup();
    const board = await boardWith((boardId) => [
      item(boardId, 'a', 0, { z: 1, data: { dock: 'd' } }),
      item(boardId, 'b', 200, { z: 2, data: { dock: 'd' } }),
    ]);
    setBoardSelection(board.id, ['a']);
    render(<Harness />);

    expect(screen.getByText('Layer 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('Docked to 1 item')).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Visible' }));
    expect(lastChange().upsertNodes?.[0]?.data).toMatchObject({ hidden: true });
    await user.click(screen.getByRole('button', { name: 'Bring forward' }));
    expect(lastChange().upsertNodes?.map((node) => [node.id, node.z])).toEqual([
      ['b', 1],
      ['a', 2],
    ]);
    await user.click(screen.getByRole('button', { name: 'Send to back' }));
    await user.click(screen.getByRole('button', { name: 'Send backward' }));
    await user.click(screen.getByRole('button', { name: 'Bring to front' }));
    await user.click(screen.getByRole('button', { name: 'Detach' }));
    expect(getBoardNodes(board.id).map((node) => node.data['dock'])).toEqual([null, null]);
  });

  it('aligns and distributes a multiple selection', async () => {
    const user = userEvent.setup();
    const board = await boardWith((boardId) => [
      item(boardId, 'a', 0),
      { ...item(boardId, 'b', 300), y: 50 },
      item(boardId, 'c', 900),
    ]);
    setBoardSelection(board.id, ['a', 'b', 'c']);
    render(<Harness />);

    expect(screen.getByRole('heading', { name: '3 items selected' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Align top (Alt+W)' }));
    expect(lastChange().upsertNodes?.map((node) => [node.id, node.y])).toEqual([['b', 0]]);
    await user.click(screen.getByRole('button', { name: 'Distribute horizontally (Alt+Shift+H)' }));
    expect(lastChange().upsertNodes?.map((node) => [node.id, node.x])).toEqual([['b', 450]]);
    await user.click(screen.getByRole('button', { name: 'Bring to front' }));
    expect(lastChange().upsertNodes).toHaveLength(3);
  });

  it('picks the asset behind a file item', async () => {
    const user = userEvent.setup();
    const { ids } = await act(() =>
      importFiles([new File(['x'], 'theme.mp3', { type: 'audio/mpeg' })], 'auto'),
    );
    const board = await boardWith((boardId) => [
      { ...createItem({ boardId, preset: 'file', rect: { x: 0, y: 0 }, z: 1 }), id: 'f' },
    ]);
    setBoardSelection(board.id, ['f']);
    render(<Harness />);

    await user.click(screen.getByRole('combobox', { name: 'File' }));
    await user.click(await screen.findByRole('option', { name: 'theme.mp3' }));
    expect(lastChange().upsertNodes?.[0]?.data).toMatchObject({ assetId: ids[0] });
  });
});
