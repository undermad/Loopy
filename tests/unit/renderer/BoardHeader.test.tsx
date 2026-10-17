import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardEditor } from '@renderer/components/editors/Board/BoardEditor';
import { AreaContext } from '@renderer/components/Shell/AreaContext';
import { createBoard } from '@renderer/lib/board';
import { areaActions } from '@renderer/lib/workspaces';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;
const setState = vi.fn();

function Harness({ state }: { state: Record<string, unknown> }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <div ref={setSlot} />
        <AreaContext value={{ areaId: 'a', headerSlot: slot }}>
          <BoardEditor areaId="a" state={state} setState={setState} />
        </AreaContext>
      </ToastProvider>
    </TooltipProvider>
  );
}

beforeEach(async () => {
  setState.mockReset();
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.projects = [project];
  api.current = project;
  api.emitProject();
  await createBoard({ name: 'Ideas' });
  await createBoard({ name: 'Levels' });
});

describe('BoardHeader', () => {
  it('switches, renames and deletes boards and toggles the view options', async () => {
    const user = userEvent.setup();
    render(<Harness state={{ grid: true, minimap: false }} />);

    await user.click(await screen.findByRole('button', { name: 'Board' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Levels' }));
    expect(setState).toHaveBeenCalledWith({ boardId: 'board-2' });

    await user.click(screen.getByRole('button', { name: 'Minimap' }));
    expect(setState).toHaveBeenCalledWith({ minimap: true });
    await user.click(screen.getByRole('button', { name: 'Grid' }));
    expect(setState).toHaveBeenCalledWith({ grid: false });
    await user.click(screen.getByRole('button', { name: 'Snap to grid' }));
    expect(setState).toHaveBeenCalledWith({ snap: true });
    const split = vi.spyOn(areaActions, 'split');
    await user.click(screen.getByRole('button', { name: 'Properties panel' }));
    expect(split).toHaveBeenCalledWith('a', 'row', 0.7, 'properties');
    await user.click(screen.getByRole('button', { name: 'Assets panel' }));
    expect(split).toHaveBeenCalledWith('a', 'row', 0.7, 'assets', true);
    await user.click(screen.getByRole('button', { name: 'Layers panel' }));
    expect(split).toHaveBeenCalledWith('a', 'row', 0.7, 'layers');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    await user.click(screen.getByRole('button', { name: 'Fit to content' }));

    await user.click(screen.getByRole('button', { name: 'Board' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Rename board' }));
    const input = await screen.findByLabelText(/Board name/);
    await user.clear(input);
    await user.type(input, 'Sketches');
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    expect(api.updateBoard).toHaveBeenCalledWith('board-1', { name: 'Sketches' });

    await user.click(screen.getByRole('button', { name: 'Board' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete board' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(api.deleteBoard).toHaveBeenCalledWith('board-1');
    expect(setState).toHaveBeenCalledWith({ boardId: 'board-2' });
  });
});

describe('BoardHeader with a single board', () => {
  it('falls back to the empty state after deleting the last board', async () => {
    const user = userEvent.setup();
    render(<Harness state={{}} />);
    for (let round = 0; round < 2; round += 1) {
      await user.click(await screen.findByRole('button', { name: 'Board' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Delete board' }));
      await user.click(await screen.findByRole('button', { name: 'Delete' }));
    }
    expect(await screen.findByText('No boards yet')).toBeInTheDocument();
    expect(setState).toHaveBeenLastCalledWith({ boardId: '' });
  });
});
