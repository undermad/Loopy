import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import type { DataDomain } from '@shared/ipc';

const READ_ONLY = /:(list|read|snapshot|get|export)\b/i;

export type DataNotifier = (event: IpcMainInvokeEvent, domain: DataDomain) => void;

export function syncingIpc(
  ipc: Pick<IpcMain, 'handle'>,
  domain: DataDomain,
  notify: DataNotifier,
): Pick<IpcMain, 'handle'> {
  return {
    handle: (channel, listener) => {
      ipc.handle(channel, async (event, ...args: unknown[]) => {
        const result: unknown = await listener(event, ...args);
        if (!READ_ONLY.test(channel)) notify(event, domain);
        return result;
      });
    },
  };
}
