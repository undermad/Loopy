import type { IpcMain } from 'electron';
import { z } from 'zod';
import { IpcChannel, entityIdSchema } from '@shared/ipc';
import {
  createPalette,
  createPaletteCluster,
  deletePalette,
  deletePaletteCluster,
  listPaletteClusters,
  listPalettes,
  updatePalette,
  updatePaletteCluster,
} from '../storage/palettes-repository';
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
  ipc.handle(IpcChannel.paletteClustersList, () => listPaletteClusters(db()));
  ipc.handle(IpcChannel.paletteClustersCreate, (_event, input: unknown) => createPaletteCluster(db(), input));
  ipc.handle(IpcChannel.paletteClustersUpdate, (_event, rawId: unknown, patch: unknown) =>
    updatePaletteCluster(db(), id(rawId), patch),
  );
  ipc.handle(IpcChannel.paletteClustersDelete, (_event, rawId: unknown, withPalettes: unknown) =>
    deletePaletteCluster(db(), id(rawId), z.boolean().parse(withPalettes)),
  );
}
