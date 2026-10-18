import type { IpcMain } from 'electron';
import { IpcChannel, entityIdSchema } from '@shared/ipc';
import {
  createCardTemplate,
  deleteCardTemplate,
  listCardTemplates,
  updateCardTemplate,
} from '../storage/card-templates-repository';
import type { TicketsHandlerDeps } from './tickets';
import { NoProjectError } from './tickets';

export function registerCardTemplatesHandlers(ipc: Pick<IpcMain, 'handle'>, deps: TicketsHandlerDeps): void {
  const db = () => {
    const project = deps.project();
    if (!project) throw new NoProjectError();
    return project.db;
  };
  const id = (raw: unknown) => entityIdSchema.parse(raw);

  ipc.handle(IpcChannel.cardTemplatesList, () => listCardTemplates(db()));
  ipc.handle(IpcChannel.cardTemplatesCreate, (_event, input: unknown) => createCardTemplate(db(), input));
  ipc.handle(IpcChannel.cardTemplatesUpdate, (_event, rawId: unknown, patch: unknown) =>
    updateCardTemplate(db(), id(rawId), patch),
  );
  ipc.handle(IpcChannel.cardTemplatesDelete, (_event, rawId: unknown) => deleteCardTemplate(db(), id(rawId)));
}
