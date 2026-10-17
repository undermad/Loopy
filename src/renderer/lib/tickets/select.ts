import { byPosition } from '@shared/ordering';
import type { Label, Ticket, TicketsSnapshot } from '@shared/tickets';

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

export function firstTodoState(snapshot: TicketsSnapshot): string | null {
  return (snapshot.states.find((state) => state.category === 'todo') ?? snapshot.states[0])?.id ?? null;
}
