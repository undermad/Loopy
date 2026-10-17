import { keyBetween } from '@shared/ordering';
import type {
  LabelInput,
  LabelPatch,
  StateInput,
  StatePatch,
  Ticket,
  TicketInput,
  TicketPatch,
} from '@shared/tickets';
import { mutate, ticketsStore } from './store';
import { ticketsInState } from './select';

export const ticketActions = {
  create: (input: TicketInput) => mutate((api) => api.createTicket(input)),
  update: (id: string, patch: TicketPatch) => mutate((api) => api.updateTicket(id, patch)),
  remove: (id: string) => mutate((api) => api.deleteTicket(id)),
  setLabels: (id: string, labelIds: string[]) => mutate((api) => api.setTicketLabels(id, labelIds)),
  moveTo(id: string, stateId: string | null, index: number) {
    const snapshot = ticketsStore.getState().snapshot;
    if (!snapshot) return Promise.resolve(snapshot);
    const column = ticketsInState(snapshot, stateId).filter((ticket) => ticket.id !== id);
    const before: Ticket | undefined = column[index - 1];
    const after: Ticket | undefined = column[index];
    const position = keyBetween(before?.position ?? null, after?.position ?? null);
    return mutate((api) => api.moveTicket({ id, stateId, position }));
  },
};

export const stateActions = {
  reorder: (id: string, index: number) => stateReorder.reorder(id, index),
  create: (input: StateInput) => mutate((api) => api.createState(input)),
  update: (id: string, patch: StatePatch) => mutate((api) => api.updateState(id, patch)),
  remove: (id: string, moveTo: string | null) => mutate((api) => api.deleteState(id, moveTo)),
  move(id: string, delta: number) {
    const snapshot = ticketsStore.getState().snapshot;
    if (!snapshot) return Promise.resolve(snapshot);
    const states = snapshot.states;
    const index = states.findIndex((state) => state.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= states.length) return Promise.resolve(snapshot);
    const others = states.filter((state) => state.id !== id);
    const position = keyBetween(others[target - 1]?.position ?? null, others[target]?.position ?? null);
    return mutate((api) => api.moveState(id, position));
  },
};

export const stateReorder = {
  reorder(id: string, index: number) {
    const snapshot = ticketsStore.getState().snapshot;
    if (!snapshot) return Promise.resolve(snapshot);
    const others = snapshot.states.filter((state) => state.id !== id);
    const clamped = Math.max(0, Math.min(index, others.length));
    const position = keyBetween(others[clamped - 1]?.position ?? null, others[clamped]?.position ?? null);
    return mutate((api) => api.moveState(id, position));
  },
};

export const labelActions = {
  create: (input: LabelInput) => mutate((api) => api.createLabel(input)),
  update: (id: string, patch: LabelPatch) => mutate((api) => api.updateLabel(id, patch)),
  remove: (id: string) => mutate((api) => api.deleteLabel(id)),
};
