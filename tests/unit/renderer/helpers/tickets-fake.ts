import { vi } from 'vitest';
import type { LoopyApi } from '@shared/ipc';
import { keyBetween } from '@shared/ordering';
import {
  commentInputSchema,
  labelInputSchema,
  sprintCompleteSchema,
  sprintInputSchema,
  stateInputSchema,
  templateInputSchema,
  ticketInputSchema,
  type Comment,
  type LabelPatch,
  type Sprint,
  type SprintPatch,
  type StatePatch,
  type TemplatePatch,
  type Ticket,
  type TicketMove,
  type TicketPatch,
  type TicketTemplate,
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
  | 'createSprint'
  | 'updateSprint'
  | 'startSprint'
  | 'completeSprint'
  | 'deleteSprint'
  | 'createComment'
  | 'updateComment'
  | 'deleteComment'
  | 'createTemplate'
  | 'updateTemplate'
  | 'deleteTemplate'
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
    sprints: [],
    comments: [],
    templates: [],
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
        description: input.description,
        type: input.type,
        priority: input.priority,
        stateId: input.stateId ?? (input.sprintId ? 'todo' : null),
        sprintId: input.sprintId,
        estimate: input.estimate,
        dueAt: input.dueAt,
        position: keyBetween(lastPosition(input.stateId), null),
        createdAt: stamp,
        updatedAt: stamp,
        resolvedAt: null,
      };
      data.snapshot.tickets.push(ticket);
      for (const labelId of input.labelIds) data.snapshot.ticketLabels.push({ ticketId: ticket.id, labelId });
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
        ticket.id === move.id
          ? {
              ...ticket,
              stateId: move.stateId ?? (move.sprintId ? 'todo' : null),
              position: move.position,
              sprintId: move.sprintId === undefined ? ticket.sprintId : move.sprintId,
            }
          : ticket,
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
    createSprint: vi.fn((raw: unknown) => {
      const input = sprintInputSchema.parse(raw);
      const sprint: Sprint = {
        id: `sprint-${String(data.snapshot.sprints.length + 1)}`,
        name: input.name,
        goal: input.goal,
        status: 'planned',
        position: keyBetween(data.snapshot.sprints.at(-1)?.position ?? null, null),
        startedAt: null,
        completedAt: null,
        createdAt: stamp,
        updatedAt: stamp,
      };
      data.snapshot.sprints.push(sprint);
      return snapshot();
    }),
    updateSprint: vi.fn((id: string, patch: SprintPatch) => {
      data.snapshot.sprints = data.snapshot.sprints.map((sprint) =>
        sprint.id === id ? merge(sprint, patch) : sprint,
      );
      return snapshot();
    }),
    startSprint: vi.fn((id: string) => {
      if (data.snapshot.sprints.some((sprint) => sprint.status === 'active')) {
        return Promise.reject(new Error('Another sprint is already active'));
      }
      data.snapshot.sprints = data.snapshot.sprints.map((sprint) =>
        sprint.id === id ? { ...sprint, status: 'active', startedAt: stamp } : sprint,
      );
      return snapshot();
    }),
    completeSprint: vi.fn((raw: unknown) => {
      const input = sprintCompleteSchema.parse(raw);
      data.snapshot.tickets = data.snapshot.tickets.map((ticket) =>
        ticket.sprintId === input.id && ticket.resolvedAt === null
          ? { ...ticket, sprintId: input.moveTo }
          : ticket,
      );
      data.snapshot.sprints = data.snapshot.sprints.map((sprint) =>
        sprint.id === input.id ? { ...sprint, status: 'completed', completedAt: stamp } : sprint,
      );
      return snapshot();
    }),
    deleteSprint: vi.fn((id: string) => {
      data.snapshot.sprints = data.snapshot.sprints.filter((sprint) => sprint.id !== id);
      data.snapshot.tickets = data.snapshot.tickets.map((ticket) =>
        ticket.sprintId === id ? { ...ticket, sprintId: null } : ticket,
      );
      return snapshot();
    }),
    createComment: vi.fn((raw: unknown) => {
      const input = commentInputSchema.parse(raw);
      const comment: Comment = {
        id: `comment-${String(data.snapshot.comments.length + 1)}`,
        ticketId: input.ticketId,
        body: input.body,
        createdAt: stamp,
        updatedAt: stamp,
      };
      data.snapshot.comments.push(comment);
      return snapshot();
    }),
    updateComment: vi.fn((id: string, body: string) => {
      data.snapshot.comments = data.snapshot.comments.map((comment) =>
        comment.id === id ? { ...comment, body } : comment,
      );
      return snapshot();
    }),
    deleteComment: vi.fn((id: string) => {
      data.snapshot.comments = data.snapshot.comments.filter((comment) => comment.id !== id);
      return snapshot();
    }),
    createTemplate: vi.fn((raw: unknown) => {
      const input = templateInputSchema.parse(raw);
      const template: TicketTemplate = {
        id: `template-${String(data.snapshot.templates.length + 1)}`,
        ...input,
        createdAt: stamp,
        updatedAt: stamp,
      };
      data.snapshot.templates.push(template);
      return snapshot();
    }),
    updateTemplate: vi.fn((id: string, patch: TemplatePatch) => {
      data.snapshot.templates = data.snapshot.templates.map((template) =>
        template.id === id ? merge(template, patch) : template,
      );
      return snapshot();
    }),
    deleteTemplate: vi.fn((id: string) => {
      data.snapshot.templates = data.snapshot.templates.filter((template) => template.id !== id);
      return snapshot();
    }),
  };
  return { api, data };
}
