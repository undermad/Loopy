import type { IpcMain } from 'electron';
import { IpcChannel, entityIdSchema } from '@shared/ipc';
import {
  createTable,
  deleteTable,
  duplicateTable,
  listTables,
  patchRows,
  readTableSnapshot,
  updateTable,
} from '../storage/tables-repository';
import { trackRename } from '../storage/notes-repository';
import type { TicketsHandlerDeps } from './tickets';
import { NoProjectError } from './tickets';

export function registerTablesHandlers(ipc: Pick<IpcMain, 'handle'>, deps: TicketsHandlerDeps): void {
  const db = () => {
    const project = deps.project();
    if (!project) throw new NoProjectError();
    return project.db;
  };
  const id = (raw: unknown) => entityIdSchema.parse(raw);

  ipc.handle(IpcChannel.tablesList, () => listTables(db()));
  ipc.handle(IpcChannel.tablesRead, (_event, rawId: unknown) => readTableSnapshot(db(), id(rawId)));
  ipc.handle(IpcChannel.tablesCreate, (_event, input: unknown) => createTable(db(), input));
  ipc.handle(IpcChannel.tablesUpdate, (_event, rawId: unknown, patch: unknown) => {
    const database = db();
    const tableId = id(rawId);
    return trackRename(database, 'table', tableId, () => updateTable(database, tableId, patch));
  });
  ipc.handle(IpcChannel.tablesDuplicate, (_event, rawId: unknown, name: unknown) =>
    duplicateTable(db(), id(rawId), name),
  );
  ipc.handle(IpcChannel.tablesDelete, (_event, rawId: unknown) => deleteTable(db(), id(rawId)));
  ipc.handle(IpcChannel.tablesPatchRows, (_event, rawId: unknown, ops: unknown) =>
    patchRows(db(), id(rawId), ops),
  );
}
