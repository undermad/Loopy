import { useStore } from 'zustand';
import type { Ticket, TicketsSnapshot } from '@shared/tickets';
import { EMPTY_SNAPSHOT, ticketsStore } from './store';

export function useTicketsSnapshot(): TicketsSnapshot {
  return useStore(ticketsStore, (state) => state.snapshot ?? EMPTY_SNAPSHOT);
}

export function useTicketsLoaded(): boolean {
  return useStore(ticketsStore, (state) => state.snapshot !== null);
}

export function useSelectedTicketId(): string | null {
  return useStore(ticketsStore, (state) => state.selectedTicketId);
}

export function useSelectedTicket(): Ticket | null {
  return useStore(
    ticketsStore,
    (state) => state.snapshot?.tickets.find((ticket) => ticket.id === state.selectedTicketId) ?? null,
  );
}
