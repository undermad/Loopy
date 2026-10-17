import { config as loadDotenv } from 'dotenv';
import { app, BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron';
import { parseEnv } from './env';
import { registerAppHandlers } from './ipc/app';
import { registerSettingsHandlers } from './ipc/settings';
import { registerShellHandlers } from './ipc/shell';
import { registerThemesHandlers } from './ipc/themes';
import { createLogger } from './services/logger';
import { createAppSettingsStore, createThemesStore, storagePaths } from './storage';
import { createMainWindow } from './window';

loadDotenv({ quiet: true });
const env = parseEnv(process.env);
const logger = createLogger(env.LOOPY_LOG_LEVEL);

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channel, payload);
}

async function start(): Promise<void> {
  const paths = storagePaths(app.getPath('userData'));
  registerAppHandlers(ipcMain, { appVersion: app.getVersion(), electronVersion: process.versions.electron });
  await registerSettingsHandlers(ipcMain, {
    store: createAppSettingsStore(paths.settings),
    broadcast,
    onLoadError: (error) => {
      logger.error(`Settings could not be read, using defaults: ${String(error)}`);
    },
  });
  registerShellHandlers(ipcMain, { nativeTheme, locale: app.getLocale(), broadcast });
  registerThemesHandlers(ipcMain, {
    store: createThemesStore(paths.themes),
    dialogs: dialog,
    appVersion: app.getVersion(),
  });
  createMainWindow();
  logger.info(`Loopy ${app.getVersion()} started`);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
}

void app.whenReady().then(start);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
