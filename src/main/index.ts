import { config as loadDotenv } from 'dotenv';
import { app, BrowserWindow, ipcMain } from 'electron';
import { parseEnv } from './env';
import { registerAppHandlers } from './ipc/app';
import { createLogger } from './services/logger';
import { createMainWindow } from './window';

loadDotenv({ quiet: true });
const env = parseEnv(process.env);
const logger = createLogger(env.LOOPY_LOG_LEVEL);

void app.whenReady().then(() => {
  registerAppHandlers(ipcMain, { appVersion: app.getVersion(), electronVersion: process.versions.electron });
  createMainWindow();
  logger.info(`Loopy ${app.getVersion()} started`);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
