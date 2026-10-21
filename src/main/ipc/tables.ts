import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { IpcMain } from 'electron';
import { IpcChannel, entityIdSchema, type ExportResult } from '@shared/ipc';
import {
  exportTable,
  importFormatOf,
  importTable,
  tableExportFormatSchema,
  tableFileName,
  tableNameFromFile,
  type TableExportFormat,
  type TableImportResult,
  type TableLookup,
  type TableSnapshot,
} from '@shared/tables';
import { trackRename } from '../storage/notes-repository';
import {
  createTable,
  deleteTable,
  duplicateTable,
  listTables,
  patchRows,
  readTableSnapshot,
  updateTable,
} from '../storage/tables-repository';
import type { FileDialogs } from './themes';
import type { TicketsHandlerDeps } from './tickets';
import { NoProjectError } from './tickets';

export interface TablesHandlerDeps extends TicketsHandlerDeps {
  dialogs: FileDialogs;
  appVersion: string;
}

const FILTERS: Record<TableExportFormat, { name: string; extensions: string[] }> = {
  csv: { name: 'CSV', extensions: ['csv'] },
  tsv: { name: 'TSV', extensions: ['tsv'] },
  json: { name: 'JSON', extensions: ['json'] },
  jsonKeyed: { name: 'JSON', extensions: ['json'] },
  markdown: { name: 'Markdown', extensions: ['md'] },
  jsonSchema: { name: 'JSON Schema', extensions: ['json'] },
  loopy: { name: 'Loopy table', extensions: ['json'] },
};

const IMPORT_FILTERS = [{ name: 'Tables', extensions: ['csv', 'tsv', 'txt', 'json'] }];

function lookupFor(db: DatabaseSync, snapshot: TableSnapshot): TableLookup {
  const snapshots = new Map<string, TableSnapshot>([[snapshot.table.id, snapshot]]);
  for (const column of snapshot.table.columns) {
    if (column.kind !== 'reference' || column.tableId === null || snapshots.has(column.tableId)) continue;
    try {
      snapshots.set(column.tableId, readTableSnapshot(db, column.tableId));
    } catch {
      continue;
    }
  }
  return {
    tableOf: (id) => snapshots.get(id)?.table,
    rowsOf: (id) => snapshots.get(id)?.rows ?? [],
  };
}

export function registerTablesHandlers(ipc: Pick<IpcMain, 'handle'>, deps: TablesHandlerDeps): void {
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
  ipc.handle(
    IpcChannel.tablesExport,
    async (_event, rawId: unknown, rawFormat: unknown): Promise<ExportResult> => {
      const database = db();
      const format = tableExportFormatSchema.parse(rawFormat);
      const snapshot = readTableSnapshot(database, id(rawId));
      const file = exportTable(snapshot, format, {
        lookup: lookupFor(database, snapshot),
        app: deps.appVersion,
      });
      const picked = await deps.dialogs.showSaveDialog({
        defaultPath: `${tableFileName(snapshot.table.name)}.${file.extension}`,
        filters: [FILTERS[format]],
      });
      if (picked.canceled || !picked.filePath) return { status: 'cancelled' };
      await writeFile(picked.filePath, file.text, 'utf8');
      return { status: 'exported' };
    },
  );
  ipc.handle(IpcChannel.tablesImport, async (_event, rawFolder: unknown): Promise<TableImportResult> => {
    const database = db();
    const folderId = rawFolder === null ? null : id(rawFolder);
    const picked = await deps.dialogs.showOpenDialog({ properties: ['openFile'], filters: IMPORT_FILTERS });
    const path = picked.filePaths[0];
    if (picked.canceled || path === undefined) return { status: 'cancelled' };
    const name = basename(path);
    const format = importFormatOf(name);
    if (!format) return { status: 'invalid', name };
    let input;
    try {
      input = importTable(await readFile(path, 'utf8'), format, tableNameFromFile(name));
    } catch {
      return { status: 'invalid', name };
    }
    return { status: 'imported', snapshot: createTable(database, { ...input, folderId }) };
  });
}
