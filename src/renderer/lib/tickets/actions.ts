import { keyBetween } from '@shared/ordering';
import type {
  LabelInput,
  LabelPatch,
  SprintInput,
  SprintPatch,
  StateInput,
  StatePatch,
  TemplateInput,
  TemplatePatch,
  Ticket,
  TicketInput,
  TicketPatch,
  TicketTemplate,
} from '@shared/tickets';
import { mutate, ticketsStore } from './store';
import { boardTickets } from './select';

export const ticketActions = {
  create: (input: TicketInput) => mutate((api) => api.createTicket(input)),
  update: (id: string, patch: TicketPatch) => mutate((api) => api.updateTicket(id, patch)),
  remove: (id: string) => mutate((api) => api.deleteTicket(id)),
  setLabels: (id: string, labelIds: string[]) => mutate((api) => api.setTicketLabels(id, labelIds)),
  moveTo(id: string, stateId: string | null, index: number) {
    const snapshot = ticketsStore.getState().snapshot;
    if (!snapshot) return Promise.resolve(snapshot);
    const column = (stateId ? boardTickets(snapshot, stateId) : []).filter((ticket) => ticket.id !== id);
    return mutate((api) => api.moveTicket({ id, stateId, position: positionAt(column, index) }));
  },
  place(id: string, sprintId: string | null, index: number, siblings: Ticket[]) {
    const snapshot = ticketsStore.getState().snapshot;
    if (!snapshot) return Promise.resolve(snapshot);
    const ticket = snapshot.tickets.find((candidate) => candidate.id === id);
    if (!ticket) return Promise.resolve(snapshot);
    const list = siblings.filter((candidate) => candidate.id !== id);
    return mutate((api) =>
      api.moveTicket({ id, stateId: ticket.stateId, sprintId, position: positionAt(list, index) }),
    );
  },
  fromTemplate(template: TicketTemplate, overrides: Partial<TicketInput> = {}) {
    return mutate((api) =>
      api.createTicket({
        title: template.title || template.name,
        description: template.description,
        type: template.type,
        priority: template.priority,
        estimate: template.estimate,
        labelIds: template.labelIds,
        ...overrides,
      }),
    );
  },
};

function positionAt(list: Ticket[], index: number): string {
  const clamped = Math.max(0, Math.min(index, list.length));
  return keyBetween(list[clamped - 1]?.position ?? null, list[clamped]?.position ?? null);
}

export const sprintActions = {
  create: (input: SprintInput) => mutate((api) => api.createSprint(input)),
  update: (id: string, patch: SprintPatch) => mutate((api) => api.updateSprint(id, patch)),
  start: (id: string) => mutate((api) => api.startSprint(id)),
  complete: (id: string, moveTo: string | null) => mutate((api) => api.completeSprint({ id, moveTo })),
  remove: (id: string) => mutate((api) => api.deleteSprint(id)),
};

export const commentActions = {
  create: (ticketId: string, body: string) => mutate((api) => api.createComment({ ticketId, body })),
  update: (id: string, body: string) => mutate((api) => api.updateComment(id, body)),
  remove: (id: string) => mutate((api) => api.deleteComment(id)),
};

export const templateActions = {
  create: (input: TemplateInput) => mutate((api) => api.createTemplate(input)),
  update: (id: string, patch: TemplatePatch) => mutate((api) => api.updateTemplate(id, patch)),
  remove: (id: string) => mutate((api) => api.deleteTemplate(id)),
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
