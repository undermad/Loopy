import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { TicketsEditor } from '@renderer/components/editors/Tickets/TicketsEditor';
import { AreaContext } from '@renderer/components/Shell/AreaContext';
import { ticketActions } from '@renderer/lib/tickets';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function Harness({ search = '' }: { search?: string }) {
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <AreaContext value={{ areaId: 'a', headerSlot: null }}>
          <TicketsEditor areaId="a" state={{ mode: 'board', search }} setState={() => undefined} />
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

describe('board columns', () => {
  it('changes category, moves columns and deletes one with its tickets going to the backlog', async () => {
    const user = userEvent.setup();
    await ticketActions.create({ title: 'Doomed', stateId: 'doing' });
    render(<Harness />);
    const doing = await screen.findByRole('region', { name: 'In progress' });

    await user.click(within(doing).getByRole('button', { name: 'In progress: Open' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Done' }));
    expect(api.updateState).toHaveBeenCalledWith('doing', { category: 'done' });

    await user.click(within(doing).getByRole('button', { name: 'In progress: Open' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move left' }));
    expect(api.moveState).toHaveBeenCalled();
    expect(screen.getAllByRole('region')[0]).toHaveAccessibleName('In progress');

    await user.click(within(doing).getByRole('button', { name: 'In progress: Open' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete state' }));
    expect(await screen.findByText(/Delete the state "In progress"\? Its 1 tickets/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(api.deleteState).toHaveBeenCalledWith('doing', null);
    expect(screen.queryByRole('region', { name: 'In progress' })).not.toBeInTheDocument();
  });

  it('filters cards by search and recolours a column', async () => {
    const user = userEvent.setup();
    await ticketActions.create({ title: 'Alpha', stateId: 'todo' });
    await ticketActions.create({ title: 'Beta', stateId: 'todo' });
    render(<Harness search="beta" />);
    const todo = await screen.findByRole('region', { name: 'To do' });

    expect(within(todo).queryByRole('button', { name: /Alpha/ })).not.toBeInTheDocument();
    expect(within(todo).getByRole('button', { name: /Beta/ })).toBeInTheDocument();

    await user.click(within(todo).getByRole('button', { name: 'Column colour' }));
    const hex = await screen.findByRole('textbox', { name: 'Column colour' });
    await user.clear(hex);
    await user.type(hex, '112233');
    expect(api.updateState).toHaveBeenLastCalledWith('todo', { color: '#112233' });
  });
});
