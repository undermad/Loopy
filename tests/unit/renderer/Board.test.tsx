import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { BoardEditor } from '@renderer/components/editors/Board/BoardEditor';
import { AreaContext } from '@renderer/components/Shell/AreaContext';
import { createBoard } from '@renderer/lib/board';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function Harness({ state }: { state: Record<string, unknown> }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <div ref={setSlot} data-testid="header" />
        <AreaContext value={{ areaId: 'a', headerSlot: slot }}>
          <BoardEditor areaId="a" state={state} setState={() => undefined} />
        </AreaContext>
      </ToastProvider>
    </TooltipProvider>
  );
}

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.projects = [project];
  api.current = project;
  api.emitProject();
});

describe('BoardEditor', () => {
  it('offers to create the first board and then shows it', async () => {
    const user = userEvent.setup();
    render(<Harness state={{}} />);

    expect(await screen.findByText('No boards yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New board' }));
    const input = await screen.findByLabelText(/Board name/);
    expect(input).toHaveValue('Board 1');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(api.createBoard).toHaveBeenCalledWith({ name: 'Board 1' });
    expect(await screen.findByRole('button', { name: 'Background colour' })).toBeInTheDocument();
    expect(api.readBoard).toHaveBeenCalled();
  });

  it('changes the background colour of the open board', async () => {
    const user = userEvent.setup();
    await createBoard({ name: 'Ideas' });
    render(<Harness state={{}} />);

    await user.click(await screen.findByRole('button', { name: 'Background colour' }));
    const hex = await screen.findByRole('textbox', { name: 'Background colour' });
    await user.clear(hex);
    await user.type(hex, 'abcdef');
    expect(api.updateBoard).toHaveBeenLastCalledWith(expect.any(String), { backgroundColor: '#abcdef' });
  });
});
