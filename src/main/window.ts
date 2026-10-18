import { join } from 'node:path';
import { BrowserWindow, shell, type BrowserWindowConstructorOptions } from 'electron';

export function createWindowOptions(preloadPath: string): BrowserWindowConstructorOptions {
  return {
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  };
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function createMainWindow(bounds?: WindowBounds): BrowserWindow {
  const options = createWindowOptions(join(__dirname, '../preload/index.cjs'));
  const window = new BrowserWindow(
    bounds
      ? {
          ...options,
          x: Math.round(bounds.x),
          y: Math.round(bounds.y),
          width: Math.max(360, Math.round(bounds.width)),
          height: Math.max(240, Math.round(bounds.height)),
          minWidth: 360,
          minHeight: 240,
        }
      : options,
  );

  window.on('ready-to-show', () => {
    window.show();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    void window.loadURL(rendererUrl);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
}
