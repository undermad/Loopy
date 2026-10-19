import type { IpcMain } from 'electron';
import { IpcChannel, entityIdSchema } from '@shared/ipc';
import {
  createItemStyle,
  deleteItemStyle,
  listItemStyles,
  updateItemStyle,
} from '../storage/item-styles-repository';
import type { TicketsHandlerDeps } from './tickets';
import { NoProjectError } from './tickets';

export function registerItemStylesHandlers(ipc: Pick<IpcMain, 'handle'>, deps: TicketsHandlerDeps): void {
  const db = () => {
    const project = deps.project();
    if (!project) throw new NoProjectError();
    return project.db;
  };
  const id = (raw: unknown) => entityIdSchema.parse(raw);

  ipc.handle(IpcChannel.itemStylesList, () => listItemStyles(db()));
  ipc.handle(IpcChannel.itemStylesCreate, (_event, input: unknown) => createItemStyle(db(), input));
  ipc.handle(IpcChannel.itemStylesUpdate, (_event, rawId: unknown, patch: unknown) =>
    updateItemStyle(db(), id(rawId), patch),
  );
  ipc.handle(IpcChannel.itemStylesDelete, (_event, rawId: unknown) => deleteItemStyle(db(), id(rawId)));
}
