import { contextBridge, ipcRenderer } from 'electron';

// Channel names are literals here so this preload shares no chunk with index.ts; a sandboxed preload must be one file.
const picker = {
  onStart: (listener: (source: unknown) => void): void => {
    ipcRenderer.on('picker:start', (_event, source: unknown) => {
      listener(source);
    });
  },
  done: (point: { x: number; y: number; width: number; height: number }): void => {
    ipcRenderer.send('picker:done', point);
  },
  cancel: (): void => {
    ipcRenderer.send('picker:done', null);
  },
};

contextBridge.exposeInMainWorld('picker', picker);
