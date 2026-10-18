import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { PropertiesEditor } from '@renderer/components/editors/Properties/PropertiesEditor';
import {
  commitChanges,
  createBoard,
  loadBoard,
  setActiveBoard,
  setBoardSelection,
  setLiveGeometry,
} from '@renderer/lib/board';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

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

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
});

describe('PropertiesEditor', () => {
  it('asks for a selection until a board is active', () => {
    render(<Harness />);
    expect(screen.getByText('Nothing selected')).toBeInTheDocument();
  });

  it('edits the active board when nothing is selected', async () => {
    const user = userEvent.setup();
    const board = await openBoard();
    render(<Harness />);

    const name = await screen.findByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Level 1{Enter}');
    expect(api.updateBoard).toHaveBeenCalledWith(board.id, { name: 'Level 1' });

    const scale = screen.getByLabelText(/Pixels per metre/);
    expect(scale).toHaveValue(100);
    await user.clear(scale);
    await user.type(scale, '50{Enter}');
    expect(api.updateBoard).toHaveBeenCalledWith(board.id, { unitScale: 50 });

    await user.click(screen.getByRole('combobox', { name: 'Unit' }));
    await user.click(await screen.findByRole('option', { name: 'Centimetres' }));
    expect(api.updateBoard).toHaveBeenCalledWith(board.id, { unit: 'cm' });

    await user.click(screen.getByRole('combobox', { name: 'Unit' }));
    await user.click(await screen.findByRole('option', { name: 'Pixels' }));
    expect(api.updateBoard).toHaveBeenCalledWith(board.id, { unit: 'px' });
    expect(await screen.findByLabelText(/Pixels per metre/)).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Grid colour' }));
    const hex = await screen.findByRole('textbox', { name: 'Grid colour' });
    await user.clear(hex);
    await user.type(hex, '336699');
    expect(api.updateBoard).toHaveBeenLastCalledWith(board.id, { gridColor: '#336699', gridRef: null });
  });

  it('shows a selected note in board units and writes edits back in pixels', async () => {
    const user = userEvent.setup();
    const board = await openBoard();
    const note = {
      id: 'n1',
      boardId: board.id,
      parentId: null,
      type: 'text' as const,
      x: 250,
      y: 0,
      width: 200,
      height: 120,
      z: 1,
      data: { text: 'hello' },
    };
    await commitChanges(board.id, { upsertNodes: [note] });
    setBoardSelection(board.id, ['n1']);
    render(<Harness />);

    const x = await screen.findByLabelText('X (m)');
    expect(x).toHaveValue(2.5);
    await user.clear(x);
    await user.type(x, '4{Enter}');
    expect(api.applyBoardChanges).toHaveBeenLastCalledWith(board.id, {
      upsertNodes: [expect.objectContaining({ id: 'n1', x: 400 }) as object],
    });

    const width = screen.getByLabelText('Width (m)');
    await user.clear(width);
    await user.type(width, '0.5{Enter}');
    expect(api.applyBoardChanges).toHaveBeenLastCalledWith(board.id, {
      upsertNodes: [expect.objectContaining({ id: 'n1', width: 50 }) as object],
    });

    act(() => {
      setLiveGeometry({ n1: { x: 775, y: 0, width: 200, height: 120 } });
    });
    expect(screen.getByLabelText('X (m)')).toHaveValue(7.75);
    act(() => {
      setLiveGeometry({ n1: null });
    });
    expect(screen.getByLabelText('X (m)')).toHaveValue(4);

    const y = screen.getByLabelText('Y (m)');
    await user.clear(y);
    await user.type(y, 'abc{Escape}');
    expect(y).toHaveValue(0);

    const text = screen.getByLabelText('Content');
    await user.clear(text);
    await user.type(text, 'changed');
    await user.tab();
    expect(api.applyBoardChanges).toHaveBeenLastCalledWith(board.id, {
      upsertNodes: [expect.objectContaining({ data: { text: 'changed' } }) as object],
    });

    act(() => {
      setBoardSelection(board.id, ['n1', 'missing']);
    });
    expect(screen.getByLabelText('X (m)')).toBeInTheDocument();
    await act(async () => {
      await commitChanges(board.id, { upsertNodes: [{ ...note, id: 'n2' }] });
      setBoardSelection(board.id, ['n1', 'n2']);
    });
    expect(screen.getByText('2 items selected')).toBeInTheDocument();
  });
});
