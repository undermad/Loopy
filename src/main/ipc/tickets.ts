import type { IpcMain } from 'electron';
import { IpcChannel, entityIdSchema, labelIdsSchema, positionSchema } from '@shared/ipc';
import type { ProjectDatabase } from '../storage/project-database';
import {
  createLabel,
  createState,
  createTicket,
  deleteLabel,
  deleteState,
  deleteTicket,
  moveState,
  moveTicket,
  readSnapshot,
  setTicketLabels,
  updateLabel,
  updateState,
  updateTicket,
} from '../storage/tickets-repository';

export interface TicketsHandlerDeps {
  project: () => ProjectDatabase | null;
}

export class NoProjectError extends Error {
  constructor() {
    super('No project is open');
    this.name = 'NoProjectError';
  }
}

export function registerTicketsHandlers(ipc: Pick<IpcMain, 'handle'>, deps: TicketsHandlerDeps): void {
  const db = () => {
    const project = deps.project();
    if (!project) throw new NoProjectError();
    return project.db;
  };
  const id = (raw: unknown) => entityIdSchema.parse(raw);
  const nullableId = (raw: unknown) => entityIdSchema.nullable().parse(raw);

  ipc.handle(IpcChannel.ticketsSnapshot, () => readSnapshot(db()));
  ipc.handle(IpcChannel.ticketsCreate, (_event, input: unknown) => createTicket(db(), input));
  ipc.handle(IpcChannel.ticketsUpdate, (_event, rawId: unknown, patch: unknown) =>
    updateTicket(db(), id(rawId), patch),
  );
  ipc.handle(IpcChannel.ticketsMove, (_event, move: unknown) => moveTicket(db(), move));
  ipc.handle(IpcChannel.ticketsDelete, (_event, rawId: unknown) => deleteTicket(db(), id(rawId)));
  ipc.handle(IpcChannel.ticketsSetLabels, (_event, rawId: unknown, rawLabels: unknown) =>
    setTicketLabels(db(), id(rawId), labelIdsSchema.parse(rawLabels)),
  );
  ipc.handle(IpcChannel.statesCreate, (_event, input: unknown) => createState(db(), input));
  ipc.handle(IpcChannel.statesUpdate, (_event, rawId: unknown, patch: unknown) =>
    updateState(db(), id(rawId), patch),
  );
  ipc.handle(IpcChannel.statesMove, (_event, rawId: unknown, rawPosition: unknown) =>
    moveState(db(), id(rawId), positionSchema.parse(rawPosition)),
  );
  ipc.handle(IpcChannel.statesDelete, (_event, rawId: unknown, rawTarget: unknown) =>
    deleteState(db(), id(rawId), nullableId(rawTarget)),
  );
  ipc.handle(IpcChannel.labelsCreate, (_event, input: unknown) => createLabel(db(), input));
  ipc.handle(IpcChannel.labelsUpdate, (_event, rawId: unknown, patch: unknown) =>
    updateLabel(db(), id(rawId), patch),
  );
  ipc.handle(IpcChannel.labelsDelete, (_event, rawId: unknown) => deleteLabel(db(), id(rawId)));
}
