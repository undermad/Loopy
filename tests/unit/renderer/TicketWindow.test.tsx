import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { TicketEditor } from '@renderer/components/editors/Tickets/TicketEditor';
import { selectTicket, sprintActions, ticketActions } from '@renderer/lib/tickets';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function Harness() {
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <TicketEditor areaId="b" state={{}} setState={() => undefined} />
      </ToastProvider>
    </TooltipProvider>
  );
}

function editableIn(region: HTMLElement): HTMLElement {
  const element = within(region)
    .getAllByLabelText('Text editor')
    .find((candidate) => candidate.getAttribute('contenteditable') === 'true');
  if (!element) throw new Error('Missing editor');
  return element;
}

async function typeInto(element: HTMLElement, text: string) {
  const paragraph = element.querySelector('p');
  if (!paragraph) throw new Error('Missing paragraph');
  await act(async () => {
    paragraph.textContent = text;
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
  await ticketActions.create({ title: 'Plan the level', stateId: 'todo' });
  selectTicket('ticket-1');
});

describe('ticket window', () => {
  it('adds, edits and deletes comments', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const comments = await screen.findByRole('region', { name: 'Comments' });
    expect(within(comments).getByText('No comments yet')).toBeInTheDocument();

    await typeInto(editableIn(comments), 'Looks good');
    await user.click(within(comments).getByRole('button', { name: 'Add comment' }));
    expect(api.createComment).toHaveBeenCalledWith({ ticketId: 'ticket-1', body: '<p>Looks good</p>' });
    expect(await within(comments).findByText('Looks good')).toBeInTheDocument();

    await user.click(within(comments).getByRole('button', { name: 'Edit comment' }));
    const editors = within(comments)
      .getAllByLabelText('Text editor')
      .filter((candidate) => candidate.getAttribute('contenteditable') === 'true');
    const editing = editors[0];
    if (!editing) throw new Error('Missing comment editor');
    await typeInto(editing, 'Looks great');
    await user.click(within(comments).getByRole('button', { name: 'Save' }));
    expect(api.updateComment).toHaveBeenCalledWith('comment-1', '<p>Looks great</p>');

    await user.click(within(comments).getByRole('button', { name: 'Delete comment' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(api.deleteComment).toHaveBeenCalledWith('comment-1');
  });

  it('edits sprint, estimate and due date, and saves the ticket as a template', async () => {
    const user = userEvent.setup();
    await sprintActions.create({ name: 'Sprint 1' });
    render(<Harness />);

    await user.click(await screen.findByRole('combobox', { name: 'Sprint' }));
    await user.click(await screen.findByRole('option', { name: 'Sprint 1' }));
    expect(api.updateTicket).toHaveBeenCalledWith('ticket-1', { sprintId: 'sprint-1' });

    const estimate = screen.getByLabelText('Estimate (points)');
    await user.type(estimate, '3{Enter}');
    expect(api.updateTicket).toHaveBeenCalledWith('ticket-1', { estimate: 3 });
    await user.clear(estimate);
    await user.type(estimate, '-1{Enter}');
    expect(api.updateTicket).not.toHaveBeenCalledWith('ticket-1', { estimate: -1 });

    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2020-01-01' } });
    expect(api.updateTicket).toHaveBeenCalledWith('ticket-1', { dueAt: '2020-01-01' });
    expect(await screen.findByText('Overdue')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save as template' }));
    const name = await screen.findByLabelText(/Template name/);
    await user.clear(name);
    await user.type(name, 'Level plan');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(api.createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Level plan', title: 'Plan the level', type: 'task' }) as object,
    );
  });
});
