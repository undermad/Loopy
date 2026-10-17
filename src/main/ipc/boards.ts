import type { IpcMain } from 'electron';
import { IpcChannel, entityIdSchema } from '@shared/ipc';
import {
  applyChanges,
  createBoard,
  deleteBoard,
  listBoards,
  readBoard,
  updateBoard,
} from '../storage/boards-repository';
import type { TicketsHandlerDeps } from './tickets';
import { NoProjectError } from './tickets';

export function registerBoardsHandlers(ipc: Pick<IpcMain, 'handle'>, deps: TicketsHandlerDeps): void {
  const db = () => {
    const project = deps.project();
    if (!project) throw new NoProjectError();
    return project.db;
  };
  const id = (raw: unknown) => entityIdSchema.parse(raw);

  ipc.handle(IpcChannel.boardsList, () => listBoards(db()));
  ipc.handle(IpcChannel.boardsCreate, (_event, input: unknown) => createBoard(db(), input));
  ipc.handle(IpcChannel.boardsUpdate, (_event, rawId: unknown, patch: unknown) =>
    updateBoard(db(), id(rawId), patch),
  );
  ipc.handle(IpcChannel.boardsDelete, (_event, rawId: unknown) => deleteBoard(db(), id(rawId)));
  ipc.handle(IpcChannel.boardsRead, (_event, rawId: unknown) => readBoard(db(), id(rawId)));
  ipc.handle(IpcChannel.boardsApplyChanges, (_event, rawId: unknown, changes: unknown) =>
    applyChanges(db(), id(rawId), changes),
  );
}
