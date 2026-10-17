import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { TicketEditor } from '@renderer/components/editors/Tickets/TicketEditor';
import { TicketsEditor } from '@renderer/components/editors/Tickets/TicketsEditor';
import { AreaContext } from '@renderer/components/Shell/AreaContext';
import { selectTicket, ticketActions, useTicketsSnapshot } from '@renderer/lib/tickets';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function Harness({ mode = 'board' }: { mode?: 'board' | 'backlog' }) {
  const snapshot = useTicketsSnapshot();
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <AreaContext value={{ areaId: 'a', headerSlot: null }}>
          <p data-testid="count">{snapshot.tickets.length}</p>
          <TicketsEditor areaId="a" state={{ mode, search: '' }} setState={() => undefined} />
          <TicketEditor areaId="b" state={{}} setState={() => undefined} />
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

describe('TicketsEditor', () => {
  it('renders the default columns and adds a ticket through quick add', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(await screen.findByRole('region', { name: 'To do' })).toBeInTheDocument();
    const todo = screen.getByRole('region', { name: 'To do' });
    await user.type(within(todo).getByRole('textbox', { name: 'Add ticket' }), 'Design the hero{Enter}');

    expect(api.createTicket).toHaveBeenCalledWith({ title: 'Design the hero', stateId: 'todo' });
    expect(await within(todo).findByRole('button', { name: 'SPA-1 Design the hero' })).toBeInTheDocument();
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('adds a state and renames it from its menu', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByRole('region', { name: 'To do' });

    await user.click(screen.getByRole('button', { name: 'Add state' }));
    await user.type(await screen.findByLabelText(/State name/), 'Review');
    await user.click(screen.getByRole('button', { name: 'Add state' }));
    expect(await screen.findByRole('region', { name: 'Review' })).toBeInTheDocument();

    const review = screen.getByRole('region', { name: 'Review' });
    await user.click(within(review).getByRole('button', { name: 'Review: Open' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Rename state' }));
    const input = await screen.findByLabelText(/State name/);
    await user.clear(input);
    await user.type(input, 'QA');
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    expect(await screen.findByRole('region', { name: 'QA' })).toBeInTheDocument();
  });

  it('selects a ticket, edits it in the ticket editor and moves backlog items to the board', async () => {
    const user = userEvent.setup();
    await ticketActions.create({ title: 'Backlog idea' });
    render(<Harness mode="backlog" />);

    expect(screen.getByText('No ticket selected')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'SPA-1 Backlog idea' }));
    const title = await screen.findByLabelText('Title');
    expect(title).toHaveValue('Backlog idea');
    await user.clear(title);
    await user.type(title, 'Polished idea{Enter}');
    expect(api.updateTicket).toHaveBeenCalledWith('ticket-1', { title: 'Polished idea' });

    await user.click(screen.getByRole('button', { name: 'Move to board' }));
    expect(api.updateTicket).toHaveBeenCalledWith('ticket-1', { stateId: 'todo' });
    expect(await screen.findByText('The backlog is empty')).toBeInTheDocument();

    selectTicket(null);
    expect(await screen.findByText('No ticket selected')).toBeInTheDocument();
  });
});

describe('LabelPicker and cards', () => {
  it('creates a label from the picker, toggles it and shows it on the card', async () => {
    const user = userEvent.setup();
    await ticketActions.create({ title: 'Tagged', stateId: 'todo' });
    render(<Harness />);

    await user.click(await screen.findByRole('button', { name: 'SPA-1 Tagged' }));
    await user.click(await screen.findByRole('button', { name: 'Add label' }));
    await user.type(await screen.findByRole('textbox', { name: 'Label name' }), 'Art');
    const [, submit] = screen.getAllByRole('button', { name: 'Add label' });
    if (!submit) throw new Error('Missing submit button');
    await user.click(submit);
    expect(api.createLabel).toHaveBeenCalledWith({ name: 'Art', color: expect.any(String) as string });
    expect(api.setTicketLabels).toHaveBeenCalledWith('ticket-1', ['label-1']);

    const toggle = await screen.findByRole('switch', { name: 'Art' });
    await user.click(toggle);
    expect(api.setTicketLabels).toHaveBeenLastCalledWith('ticket-1', []);
    await user.keyboard('{Escape}');

    const card = screen.getByRole('button', { name: 'SPA-1 Tagged' });
    card.focus();
    await user.keyboard('{Enter}');
    expect(card).toHaveAttribute('aria-pressed', 'true');
  });

  it('deletes the selected ticket from the ticket editor and changes priority and state', async () => {
    const user = userEvent.setup();
    await ticketActions.create({ title: 'Doomed', stateId: 'todo' });
    render(<Harness />);

    await user.click(await screen.findByRole('button', { name: 'SPA-1 Doomed' }));
    await user.click(await screen.findByRole('combobox', { name: 'Priority' }));
    await user.click(await screen.findByRole('option', { name: 'Urgent' }));
    expect(api.updateTicket).toHaveBeenCalledWith('ticket-1', { priority: 'urgent' });

    await user.click(screen.getByRole('combobox', { name: 'State' }));
    await user.click(await screen.findByRole('option', { name: 'Backlog' }));
    expect(api.updateTicket).toHaveBeenCalledWith('ticket-1', { stateId: null });

    await user.click(screen.getByRole('button', { name: 'Delete ticket' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(api.deleteTicket).toHaveBeenCalledWith('ticket-1');
    expect(await screen.findByText('No ticket selected')).toBeInTheDocument();
  });
});

describe('ticket description', () => {
  it('saves the description on blur and ignores an unchanged title', async () => {
    const user = userEvent.setup();
    await ticketActions.create({ title: 'Notes', stateId: 'todo' });
    render(<Harness />);

    await user.click(await screen.findByRole('button', { name: 'SPA-1 Notes' }));
    const description = await screen.findByLabelText('Description');
    await user.type(description, 'Some detail');
    description.blur();
    expect(api.updateTicket).toHaveBeenCalledWith('ticket-1', { description: 'Some detail' });

    const title = screen.getByLabelText('Title');
    title.focus();
    title.blur();
    expect(api.updateTicket).toHaveBeenCalledTimes(1);
  });
});
