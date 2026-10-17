import type { IpcMain } from 'electron';
import { IpcChannel, entityIdSchema } from '@shared/ipc';
import { createPalette, deletePalette, listPalettes, updatePalette } from '../storage/palettes-repository';
import type { TicketsHandlerDeps } from './tickets';
import { NoProjectError } from './tickets';

export function registerPalettesHandlers(ipc: Pick<IpcMain, 'handle'>, deps: TicketsHandlerDeps): void {
  const db = () => {
    const project = deps.project();
    if (!project) throw new NoProjectError();
    return project.db;
  };
  const id = (raw: unknown) => entityIdSchema.parse(raw);

  ipc.handle(IpcChannel.palettesList, () => listPalettes(db()));
  ipc.handle(IpcChannel.palettesCreate, (_event, input: unknown) => createPalette(db(), input));
  ipc.handle(IpcChannel.palettesUpdate, (_event, rawId: unknown, patch: unknown) =>
    updatePalette(db(), id(rawId), patch),
  );
  ipc.handle(IpcChannel.palettesDelete, (_event, rawId: unknown) => deletePalette(db(), id(rawId)));
}
