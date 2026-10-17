import { config as loadDotenv } from 'dotenv';
import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from 'electron';
import { parseEnv } from './env';
import { registerAppHandlers } from './ipc/app';
import { registerBoardsHandlers } from './ipc/boards';
import { registerLayoutsHandlers } from './ipc/layouts';
import { registerProjectHandlers } from './ipc/project';
import { registerSettingsHandlers } from './ipc/settings';
import { registerShellHandlers } from './ipc/shell';
import { registerStateHandlers } from './ipc/state';
import { registerThemesHandlers } from './ipc/themes';
import { registerTicketsHandlers } from './ipc/tickets';
import { registerWindowHandlers } from './ipc/window';
import { createDeviceStateService } from './services/device-state';
import { createLogger } from './services/logger';
import {
  createAppSettingsStore,
  createDeviceStateStore,
  createLayoutsStore,
  createThemesStore,
  storagePaths,
} from './storage';
import { createMainWindow } from './window';

loadDotenv({ quiet: true });
const env = parseEnv(process.env);
const logger = createLogger(env.LOOPY_LOG_LEVEL);
if (env.LOOPY_USER_DATA) app.setPath('userData', env.LOOPY_USER_DATA);

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channel, payload);
}

async function start(): Promise<void> {
  const paths = storagePaths(app.getPath('userData'));
  const appVersion = app.getVersion();
  const deviceState = await createDeviceStateService(createDeviceStateStore(paths.deviceState), (error) => {
    logger.error(`Device state could not be read, using defaults: ${String(error)}`);
  });

  registerAppHandlers(ipcMain, { appVersion, electronVersion: process.versions.electron });
  await registerSettingsHandlers(ipcMain, {
    store: createAppSettingsStore(paths.settings),
    broadcast,
    onLoadError: (error) => {
      logger.error(`Settings could not be read, using defaults: ${String(error)}`);
    },
  });
  registerShellHandlers(ipcMain, { nativeTheme, locale: app.getLocale(), broadcast });
  registerWindowHandlers(ipcMain, { windowFor: (event) => BrowserWindow.fromWebContents(event.sender) });
  registerThemesHandlers(ipcMain, { store: createThemesStore(paths.themes), dialogs: dialog, appVersion });
  registerLayoutsHandlers(ipcMain, { store: createLayoutsStore(paths.layouts), dialogs: dialog, appVersion });
  registerStateHandlers(ipcMain, { deviceState });
  const projects = registerProjectHandlers(ipcMain, {
    paths,
    deviceState,
    dialogs: dialog,
    broadcast,
    revealInFolder: (path) => {
      shell.showItemInFolder(path);
    },
  });
  registerTicketsHandlers(ipcMain, { project: () => projects.current() });
  registerBoardsHandlers(ipcMain, { project: () => projects.current() });
  app.on('before-quit', () => {
    void projects.close();
  });

  createMainWindow();
  logger.info(`Loopy ${appVersion} started`);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
}

void app.whenReady().then(start);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
