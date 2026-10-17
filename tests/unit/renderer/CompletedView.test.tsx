import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { CompletedView } from '@renderer/components/editors/Tickets/CompletedView';
import { sprintActions, ticketActions } from '@renderer/lib/tickets';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function Harness({ search = '' }: { search?: string }) {
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <CompletedView search={search} />
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

describe('CompletedView', () => {
  it('shows an empty state until something is completed', () => {
    render(<Harness />);
    expect(screen.getByText('Nothing completed yet')).toBeInTheDocument();
  });

  it('groups completed sprints and lists resolved tickets outside sprints', async () => {
    const user = userEvent.setup();
    await sprintActions.create({ name: 'Sprint 1' });
    await sprintActions.start('sprint-1');
    await ticketActions.create({ title: 'Shipped', sprintId: 'sprint-1', stateId: 'done' });
    await ticketActions.update('ticket-1', { stateId: 'done' });
    api.tickets.snapshot.tickets = api.tickets.snapshot.tickets.map((ticket) =>
      ticket.id === 'ticket-1' ? { ...ticket, resolvedAt: '2026-10-17T10:00:00.000Z' } : ticket,
    );
    await ticketActions.create({ title: 'Left over', sprintId: 'sprint-1' });
    await sprintActions.complete('sprint-1', null);
    await ticketActions.create({ title: 'Loose fix', stateId: 'done' });
    api.tickets.snapshot.tickets = api.tickets.snapshot.tickets.map((ticket) =>
      ticket.title === 'Loose fix' ? { ...ticket, resolvedAt: '2026-10-18T10:00:00.000Z' } : ticket,
    );
    await ticketActions.update('ticket-3', { priority: 'low' });
    render(<Harness />);

    const sprint = await screen.findByRole('region', { name: 'Sprint 1' });
    expect(within(sprint).getByRole('button', { name: 'SPA-1 Shipped' })).toBeInTheDocument();
    expect(within(sprint).queryByRole('button', { name: 'SPA-2 Left over' })).not.toBeInTheDocument();
    const loose = screen.getByRole('region', { name: 'Completed outside sprints' });
    expect(within(loose).getByRole('button', { name: 'SPA-3 Loose fix' })).toBeInTheDocument();

    await user.click(within(sprint).getByRole('button', { name: /Sprint 1/ }));
    expect(within(sprint).queryByRole('button', { name: 'SPA-1 Shipped' })).not.toBeInTheDocument();
    await user.click(within(sprint).getByRole('button', { name: /Sprint 1/ }));
    expect(within(sprint).getByRole('button', { name: 'SPA-1 Shipped' })).toBeInTheDocument();
  });

  it('filters by search', async () => {
    await ticketActions.create({ title: 'Alpha done', stateId: 'done' });
    api.tickets.snapshot.tickets = api.tickets.snapshot.tickets.map((ticket) => ({
      ...ticket,
      resolvedAt: '2026-10-17T10:00:00.000Z',
    }));
    await ticketActions.update('ticket-1', { priority: 'low' });
    render(<Harness search="zzz" />);
    expect(await screen.findByText('Nothing completed yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Alpha/ })).not.toBeInTheDocument();
  });
});
