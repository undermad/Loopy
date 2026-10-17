import { vi } from 'vitest';
import type { LoopyApi } from '@shared/ipc';
import { keyBetween } from '@shared/ordering';
import {
  labelInputSchema,
  stateInputSchema,
  ticketInputSchema,
  type LabelPatch,
  type StatePatch,
  type Ticket,
  type TicketMove,
  type TicketPatch,
  type TicketsSnapshot,
} from '@shared/tickets';

export type TicketsFakeApi = Pick<
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

function merge<T extends object>(item: T, patch: object): T {
  const defined = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
  return { ...item, ...defined };
}

export function emptyTicketsSnapshot(): TicketsSnapshot {
  return {
    states: [
      { id: 'todo', name: 'To do', position: 'a', category: 'todo', color: '#64748b' },
      { id: 'doing', name: 'In progress', position: 'i', category: 'doing', color: '#2563eb' },
      { id: 'done', name: 'Done', position: 'r', category: 'done', color: '#16a34a' },
    ],
    tickets: [],
    labels: [],
    ticketLabels: [],
  };
}

export function createTicketsFake(initial: TicketsSnapshot = emptyTicketsSnapshot()) {
  const data = { snapshot: initial };
  const stamp = '2026-10-17T09:00:00.000Z';
  const snapshot = (): Promise<TicketsSnapshot> => Promise.resolve(structuredClone(data.snapshot));
  const lastPosition = (stateId: string | null): string | null =>
    data.snapshot.tickets
      .filter((ticket) => ticket.stateId === stateId)
      .map((ticket) => ticket.position)
      .sort()
      .at(-1) ?? null;
  const api: TicketsFakeApi = {
    getTickets: vi.fn(snapshot),
    createTicket: vi.fn((raw: unknown) => {
      const input = ticketInputSchema.parse(raw);
      const number = Math.max(0, ...data.snapshot.tickets.map((ticket) => ticket.number)) + 1;
      const ticket: Ticket = {
        id: `ticket-${String(number)}`,
        number,
        title: input.title,
        description: '',
        type: input.type,
        priority: input.priority,
        stateId: input.stateId,
        position: keyBetween(lastPosition(input.stateId), null),
        createdAt: stamp,
        updatedAt: stamp,
        resolvedAt: null,
      };
      data.snapshot.tickets.push(ticket);
      return snapshot();
    }),
    updateTicket: vi.fn((id: string, patch: TicketPatch) => {
      data.snapshot.tickets = data.snapshot.tickets.map((ticket) =>
        ticket.id === id ? merge(ticket, patch) : ticket,
      );
      return snapshot();
    }),
    moveTicket: vi.fn((move: TicketMove) => {
      data.snapshot.tickets = data.snapshot.tickets.map((ticket) =>
        ticket.id === move.id ? { ...ticket, stateId: move.stateId, position: move.position } : ticket,
      );
      return snapshot();
    }),
    deleteTicket: vi.fn((id: string) => {
      data.snapshot.tickets = data.snapshot.tickets.filter((ticket) => ticket.id !== id);
      return snapshot();
    }),
    setTicketLabels: vi.fn((id: string, labelIds: string[]) => {
      data.snapshot.ticketLabels = [
        ...data.snapshot.ticketLabels.filter((link) => link.ticketId !== id),
        ...labelIds.map((labelId) => ({ ticketId: id, labelId })),
      ];
      return snapshot();
    }),
    createState: vi.fn((raw: unknown) => {
      const input = stateInputSchema.parse(raw);
      const last = data.snapshot.states.at(-1)?.position ?? null;
      data.snapshot.states.push({
        id: `state-${String(data.snapshot.states.length + 1)}`,
        name: input.name,
        position: keyBetween(last, null),
        category: input.category,
        color: input.color ?? '#9333ea',
      });
      return snapshot();
    }),
    updateState: vi.fn((id: string, patch: StatePatch) => {
      data.snapshot.states = data.snapshot.states.map((state) =>
        state.id === id ? merge(state, patch) : state,
      );
      return snapshot();
    }),
    moveState: vi.fn((id: string, position: string) => {
      data.snapshot.states = data.snapshot.states
        .map((state) => (state.id === id ? { ...state, position } : state))
        .sort((a, b) => a.position.localeCompare(b.position));
      return snapshot();
    }),
    deleteState: vi.fn((id: string, moveTo: string | null) => {
      data.snapshot.states = data.snapshot.states.filter((state) => state.id !== id);
      data.snapshot.tickets = data.snapshot.tickets.map((ticket) =>
        ticket.stateId === id ? { ...ticket, stateId: moveTo } : ticket,
      );
      return snapshot();
    }),
    createLabel: vi.fn((raw: unknown) => {
      const input = labelInputSchema.parse(raw);
      data.snapshot.labels.push({ id: `label-${String(data.snapshot.labels.length + 1)}`, ...input });
      return snapshot();
    }),
    updateLabel: vi.fn((id: string, patch: LabelPatch) => {
      data.snapshot.labels = data.snapshot.labels.map((label) =>
        label.id === id ? merge(label, patch) : label,
      );
      return snapshot();
    }),
    deleteLabel: vi.fn((id: string) => {
      data.snapshot.labels = data.snapshot.labels.filter((label) => label.id !== id);
      return snapshot();
    }),
  };
  return { api, data };
}
