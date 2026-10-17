import { createStore } from 'zustand/vanilla';
import type { LoopyApi } from '@shared/ipc';
import type { TicketsSnapshot } from '@shared/tickets';
import { subscribeCurrentProject } from '@renderer/lib/project';

export type TicketsApi = Pick<
  LoopyApi,
  | 'getTickets'
  | 'createTicket'
  | 'updateTicket'
  | 'moveTicket'
  | 'deleteTicket'
  | 'setTicketLabels'
  | 'createState'
  | 'updateState'
  | 'moveState'
  | 'deleteState'
  | 'createLabel'
  | 'updateLabel'
  | 'deleteLabel'
>;

export interface TicketsState {
  snapshot: TicketsSnapshot | null;
  selectedTicketId: string | null;
  api: TicketsApi | null;
}

export const EMPTY_SNAPSHOT: TicketsSnapshot = { states: [], tickets: [], labels: [], ticketLabels: [] };

export const ticketsStore = createStore<TicketsState>(() => ({
  snapshot: null,
  selectedTicketId: null,
  api: null,
}));

export function requireApi(): TicketsApi {
  const { api } = ticketsStore.getState();
  if (!api) throw new Error('Tickets are not loaded');
  return api;
}

let loadToken = 0;

export async function loadTickets(): Promise<void> {
  loadToken += 1;
  const token = loadToken;
  const snapshot = await requireApi().getTickets();
  if (token === loadToken) ticketsStore.setState({ snapshot });
}

export async function bootTickets(api: TicketsApi, hasProject: boolean): Promise<void> {
  ticketsStore.setState({ api });
  if (hasProject) await loadTickets();
  subscribeCurrentProject((project) => {
    ticketsStore.setState({ snapshot: null, selectedTicketId: null });
    if (project) void loadTickets();
  });
}

export function applySnapshot(snapshot: TicketsSnapshot): void {
  const { selectedTicketId } = ticketsStore.getState();
  const stillThere =
    selectedTicketId !== null && snapshot.tickets.some((ticket) => ticket.id === selectedTicketId);
  ticketsStore.setState({ snapshot, selectedTicketId: stillThere ? selectedTicketId : null });
}

export async function mutate(run: (api: TicketsApi) => Promise<TicketsSnapshot>): Promise<TicketsSnapshot> {
  const snapshot = await run(requireApi());
  loadToken += 1;
  applySnapshot(snapshot);
  return snapshot;
}

export function selectTicket(id: string | null): void {
  ticketsStore.setState({ selectedTicketId: id });
}

export function resetTicketsStore(): void {
  ticketsStore.setState({ snapshot: null, selectedTicketId: null, api: null });
}
