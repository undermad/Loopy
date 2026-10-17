import { byPosition } from '@shared/ordering';
import type { Comment, Label, Sprint, Ticket, TicketsSnapshot } from '@shared/tickets';

export function ticketsInState(snapshot: TicketsSnapshot, stateId: string | null): Ticket[] {
  return snapshot.tickets.filter((ticket) => ticket.stateId === stateId).sort(byPosition);
}

export function labelsOf(snapshot: TicketsSnapshot, ticketId: string): Label[] {
  const ids = new Set(
    snapshot.ticketLabels.filter((link) => link.ticketId === ticketId).map((link) => link.labelId),
  );
  return snapshot.labels.filter((label) => ids.has(label.id));
}

export function matchesSearch(ticket: Ticket, key: string, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return ticket.title.toLowerCase().includes(needle) || key.toLowerCase().includes(needle);
}

export function activeSprint(snapshot: TicketsSnapshot): Sprint | null {
  return snapshot.sprints.find((sprint) => sprint.status === 'active') ?? null;
}

export function openSprints(snapshot: TicketsSnapshot): Sprint[] {
  return snapshot.sprints
    .filter((sprint) => sprint.status !== 'completed')
    .sort((a, b) => (a.status === b.status ? byPosition(a, b) : a.status === 'active' ? -1 : 1));
}

export function completedSprints(snapshot: TicketsSnapshot): Sprint[] {
  return snapshot.sprints
    .filter((sprint) => sprint.status === 'completed')
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
}

export function ticketsInSprint(snapshot: TicketsSnapshot, sprintId: string | null): Ticket[] {
  return snapshot.tickets.filter((ticket) => ticket.sprintId === sprintId).sort(byPosition);
}

export function boardTickets(snapshot: TicketsSnapshot, stateId: string): Ticket[] {
  const sprint = activeSprint(snapshot);
  return ticketsInState(snapshot, stateId).filter((ticket) => !sprint || ticket.sprintId === sprint.id);
}

export function completedTickets(snapshot: TicketsSnapshot): Ticket[] {
  const closed = new Set(completedSprints(snapshot).map((sprint) => sprint.id));
  return snapshot.tickets
    .filter(
      (ticket) => ticket.resolvedAt !== null && (ticket.sprintId === null || !closed.has(ticket.sprintId)),
    )
    .sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? ''));
}

export function commentsOf(snapshot: TicketsSnapshot, ticketId: string): Comment[] {
  return snapshot.comments.filter((comment) => comment.ticketId === ticketId);
}

export function estimateOf(tickets: Ticket[]): number {
  return tickets.reduce((sum, ticket) => sum + (ticket.estimate ?? 0), 0);
}

export function firstTodoState(snapshot: TicketsSnapshot): string | null {
  return (snapshot.states.find((state) => state.category === 'todo') ?? snapshot.states[0])?.id ?? null;
}
