import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron';
import { IpcChannel, editCommandSchema } from '@shared/ipc';

export interface WindowHandlerDeps {
  windowFor: (
    event: IpcMainInvokeEvent,
  ) => Pick<BrowserWindow, 'isFullScreen' | 'setFullScreen' | 'webContents'> | null;
}

export function registerWindowHandlers(ipc: Pick<IpcMain, 'handle'>, deps: WindowHandlerDeps): void {
  ipc.handle(IpcChannel.windowToggleFullscreen, (event) => {
    const window = deps.windowFor(event);
    if (!window) return false;
    const next = !window.isFullScreen();
    window.setFullScreen(next);
    return next;
  });
  ipc.handle(IpcChannel.windowEditCommand, (event, raw: unknown) => {
    const command = editCommandSchema.parse(raw);
    const contents = deps.windowFor(event)?.webContents;
    if (!contents) return;
    contents[command]();
  });
}
