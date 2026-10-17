import type { IpcMain } from 'electron';
import { IpcChannel } from '@shared/ipc';

export interface ColourHandlerDeps {
  pickScreenColour: () => Promise<string | null>;
}

export function registerColourHandlers(ipc: Pick<IpcMain, 'handle'>, deps: ColourHandlerDeps): void {
  ipc.handle(IpcChannel.colourPickScreen, () => deps.pickScreenColour());
}
