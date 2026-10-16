import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannel, appVersionSchema, type LoopyApi } from '@shared/ipc';

const api: LoopyApi = {
  getAppVersion: async () => appVersionSchema.parse(await ipcRenderer.invoke(IpcChannel.getAppVersion)),
};

contextBridge.exposeInMainWorld('loopy', api);
