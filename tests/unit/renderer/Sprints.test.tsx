import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketsEditor } from '@renderer/components/editors/Tickets/TicketsEditor';
import { AreaContext } from '@renderer/components/Shell/AreaContext';
import { sprintActions, templateActions, ticketActions } from '@renderer/lib/tickets';
import { areaActions } from '@renderer/lib/workspaces';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function Harness({ mode }: { mode: 'board' | 'backlog' | 'completed' }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <div ref={setSlot} />
        <AreaContext value={{ areaId: 'a', headerSlot: slot }}>
          <TicketsEditor areaId="a" state={{ mode, search: '' }} setState={() => undefined} />
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

describe('sprints in the backlog', () => {
  it('starts, edits, completes and deletes sprints', async () => {
    const user = userEvent.setup();
    await sprintActions.create({ name: 'Sprint 1' });
    await sprintActions.create({ name: 'Sprint 2' });
    await ticketActions.create({ title: 'Hero art', sprintId: 'sprint-1' });
    await ticketActions.create({ title: 'Hero code', sprintId: 'sprint-1', stateId: 'done' });
    await ticketActions.update('ticket-2', { stateId: 'done' });
    render(<Harness mode="backlog" />);

    const first = await screen.findByRole('region', { name: 'Sprint 1' });
    expect(within(first).getByText('2 tickets · 0 pt')).toBeInTheDocument();
    await user.click(within(first).getByRole('button', { name: 'Start sprint' }));
    expect(api.startSprint).toHaveBeenCalledWith('sprint-1');
    expect(await within(first).findByText('Active')).toBeInTheDocument();
    const second = screen.getByRole('region', { name: 'Sprint 2' });
    expect(within(second).getByRole('button', { name: 'Start sprint' })).toBeDisabled();

    await user.click(within(first).getByRole('button', { name: 'Sprint 1: Open' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit sprint' }));
    await user.type(await screen.findByLabelText(/Sprint goal/), 'Finish the hero');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(api.updateSprint).toHaveBeenCalledWith('sprint-1', { name: 'Sprint 1', goal: 'Finish the hero' });
    expect(await within(first).findByText('Finish the hero')).toBeInTheDocument();

    await user.click(within(first).getByRole('button', { name: 'Complete sprint' }));
    await user.click(await screen.findByRole('combobox', { name: 'Move unfinished tickets to' }));
    await user.click(await screen.findByRole('option', { name: 'Sprint 2' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Complete sprint' }));
    expect(api.completeSprint).toHaveBeenCalledWith({ id: 'sprint-1', moveTo: 'sprint-2' });
    expect(screen.queryByRole('region', { name: 'Sprint 1' })).not.toBeInTheDocument();
    expect(await within(second).findByRole('button', { name: 'SPA-1 Hero art' })).toBeInTheDocument();

    await user.click(within(second).getByRole('button', { name: 'Sprint 2: Open' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete sprint' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(api.deleteSprint).toHaveBeenCalledWith('sprint-2');
    expect(
      await within(screen.getByRole('region', { name: 'Backlog' })).findByRole('button', {
        name: 'SPA-1 Hero art',
      }),
    ).toBeInTheDocument();
  });

  it('shows only the active sprint on the board and names it in the header', async () => {
    await sprintActions.create({ name: 'Sprint 1' });
    await sprintActions.start('sprint-1');
    await ticketActions.create({ title: 'In sprint', sprintId: 'sprint-1' });
    await ticketActions.create({ title: 'Outside', stateId: 'todo' });
    render(<Harness mode="board" />);
    const todo = await screen.findByRole('region', { name: 'To do' });
    expect(within(todo).getByRole('button', { name: 'SPA-1 In sprint' })).toBeInTheDocument();
    expect(within(todo).queryByRole('button', { name: 'SPA-2 Outside' })).not.toBeInTheDocument();
    expect(screen.getByText('Active sprint: Sprint 1')).toBeInTheDocument();
  });
});

describe('templates and the ticket panel', () => {
  it('creates tickets from templates, manages them and toggles the panel', async () => {
    const user = userEvent.setup();
    await templateActions.create({ name: 'Bug report', title: 'Bug: ', type: 'bug', priority: 'high' });
    const split = vi.spyOn(areaActions, 'split');
    render(<Harness mode="board" />);

    await user.click(await screen.findByRole('button', { name: 'New ticket' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Bug report' }));
    expect(api.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Bug: ', type: 'bug', priority: 'high' }) as object,
    );
    expect(split).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'New ticket' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Blank ticket' }));
    await user.type(await screen.findByLabelText(/Title/), 'Fresh{Enter}');
    expect(api.createTicket).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Fresh' }) as object);

    await user.click(screen.getByRole('button', { name: 'New ticket' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Manage templates' }));
    await user.click(await screen.findByRole('button', { name: 'Delete template: Bug report' }));
    expect(api.deleteTemplate).toHaveBeenCalledWith('template-1');
    expect(await screen.findByText(/No templates yet/)).toBeInTheDocument();
    await user.keyboard('{Escape}');

    const close = vi.spyOn(areaActions, 'close');
    expect(screen.getByRole('button', { name: 'Ticket panel' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Ticket panel' }));
    expect(close).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Ticket panel' })).not.toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Ticket panel' }));
    expect(split).toHaveBeenCalledWith('a', 'row', 0.7, 'ticket');
  });
});
