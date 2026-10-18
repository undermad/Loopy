import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron';
import type { LayoutNode } from '@shared/layout';
import {
  IpcChannel,
  detachAreaSchema,
  editCommandSchema,
  detachedLayoutSchema,
  type DetachArea,
} from '@shared/ipc';
import { layoutNodeSchema } from '@shared/layout';

export interface WindowHandlerDeps {
  windowFor: (
    event: IpcMainInvokeEvent,
  ) => Pick<BrowserWindow, 'isFullScreen' | 'setFullScreen' | 'webContents'> | null;
  detach: (input: DetachArea) => void;
  layoutFor: (event: IpcMainInvokeEvent) => LayoutNode | null;
  returnLayout: (event: IpcMainInvokeEvent, layout: LayoutNode) => void;
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
  ipc.handle(IpcChannel.windowDetachArea, (_event, raw: unknown) => {
    deps.detach(detachAreaSchema.parse(raw));
  });
  ipc.handle(IpcChannel.windowDetachedLayout, (event) => detachedLayoutSchema.parse(deps.layoutFor(event)));
  ipc.handle(IpcChannel.windowReturnLayout, (event, raw: unknown) => {
    deps.returnLayout(event, layoutNodeSchema.parse(raw));
  });
}
