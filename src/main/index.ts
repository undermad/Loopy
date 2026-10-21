import { config as loadDotenv } from 'dotenv';
import { join } from 'node:path';
import {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  ipcMain,
  nativeTheme,
  protocol,
  screen,
  shell,
} from 'electron';
import { ASSET_PROTOCOL } from '@shared/assets';
import { assetSchemePrivileges, handleAssetRequest } from './asset-protocol';
import { parseEnv, userDataOverride } from './env';
import { openFailedDialog, projectPathFromArgv, saveChangesDialog, saveChoice } from './open-file';
import { resolveLanguage } from '@shared/i18n';
import { registerAppHandlers } from './ipc/app';
import { registerAssetsHandlers } from './ipc/assets';
import { registerBoardsHandlers } from './ipc/boards';
import { registerColourHandlers } from './ipc/colour';
import { registerLayoutsHandlers } from './ipc/layouts';
import { registerCardTemplatesHandlers } from './ipc/card-templates';
import { registerItemStylesHandlers } from './ipc/item-styles';
import { registerTablesHandlers } from './ipc/tables';
import { registerNotesHandlers } from './ipc/notes';
import { registerPalettesHandlers } from './ipc/palettes';
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
  createScreenPicker,
  handlePickerRequest,
  hexFromBgra,
  PICKER_PROTOCOL,
  pickerSchemePrivileges,
  scalePoint,
  sourceForDisplay,
  type PickerDisplay,
  type PickerWindow,
} from './screen-picker';
import {
  createAppSettingsStore,
  createDeviceStateStore,
  createLayoutsStore,
  createThemesStore,
  storagePaths,
} from './storage';
import { IpcChannel } from '@shared/ipc';
import type { LayoutNode } from '@shared/layout';
import { createMainWindow } from './window';
import { syncingIpc, type DataNotifier } from './ipc/sync';

loadDotenv({ quiet: true });
const env = parseEnv(process.env);
const logger = createLogger(env.LOOPY_LOG_LEVEL);
const userData = userDataOverride(env, { packaged: app.isPackaged, appData: app.getPath('appData') });
if (userData) app.setPath('userData', userData);
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
protocol.registerSchemesAsPrivileged([assetSchemePrivileges, pickerSchemePrivileges]);

function pickerWindow(window: BrowserWindow): Omit<PickerWindow, 'webContentsId'> {
  return {
    loadURL: (url) => window.loadURL(url),
    show: () => {
      window.show();
      window.focus();
    },
    hide: () => {
      if (!window.isDestroyed()) window.hide();
    },
    send: (channel, payload) => {
      if (!window.isDestroyed()) window.webContents.send(channel, payload);
    },
    close: () => {
      if (!window.isDestroyed()) window.close();
    },
    on: (event, listener) => {
      window.on(event, listener);
    },
  };
}

async function screenSource(display: PickerDisplay, thumbnailSize: { width: number; height: number }) {
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize });
  const index = screen.getAllDisplays().findIndex((item) => item.id === display.id);
  return sourceForDisplay(sources, display.id, index);
}

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channel, payload);
}

async function start(): Promise<void> {
  const paths = storagePaths(app.getPath('userData'));
  const appVersion = app.getVersion();
  const deviceState = await createDeviceStateService(createDeviceStateStore(paths.deviceState), (error) => {
    logger.error(`Device state could not be read, using defaults: ${String(error)}`);
  });

  registerAppHandlers(ipcMain, {
    appVersion,
    electronVersion: process.versions.electron,
    quit: () => {
      app.quit();
    },
  });
  const settings = await registerSettingsHandlers(ipcMain, {
    store: createAppSettingsStore(paths.settings),
    broadcast,
    onLoadError: (error) => {
      logger.error(`Settings could not be read, using defaults: ${String(error)}`);
    },
  });
  registerShellHandlers(ipcMain, { nativeTheme, locale: app.getLocale(), broadcast });
  const detached = new Map<number, LayoutNode>();
  let mainWindow: BrowserWindow | null = null;
  registerWindowHandlers(ipcMain, {
    windowFor: (event) => BrowserWindow.fromWebContents(event.sender),
    detach: ({ layout, ...bounds }) => {
      const window = createMainWindow(bounds);
      const id = window.webContents.id;
      detached.set(id, layout);
      window.on('closed', () => {
        detached.delete(id);
      });
    },
    layoutFor: (event) => detached.get(event.sender.id) ?? null,
    returnLayout: (event, layout) => {
      mainWindow?.webContents.send(IpcChannel.windowLayoutReturned, layout);
      BrowserWindow.fromWebContents(event.sender)?.close();
    },
  });
  const notify: DataNotifier = (event, domain) => {
    void projects.markDirty();
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.webContents.id !== event.sender.id)
        window.webContents.send(IpcChannel.projectDataChanged, { domain });
    }
  };
  registerThemesHandlers(ipcMain, { store: createThemesStore(paths.themes), dialogs: dialog, appVersion });
  registerLayoutsHandlers(ipcMain, { store: createLayoutsStore(paths.layouts), dialogs: dialog, appVersion });
  registerStateHandlers(ipcMain, { deviceState });
  const projects = await registerProjectHandlers(ipcMain, {
    paths,
    deviceState,
    dialogs: dialog,
    broadcast,
    revealInFolder: (path) => {
      shell.showItemInFolder(path);
    },
    confirmSave: async (name) => {
      const options = saveChangesDialog(language(), name);
      const result = mainWindow
        ? await dialog.showMessageBox(mainWindow, options)
        : await dialog.showMessageBox(options);
      return saveChoice(result.response);
    },
  });
  const language = () => resolveLanguage(settings.current().language, app.getLocale());
  registerTicketsHandlers(syncingIpc(ipcMain, 'tickets', notify), { project: () => projects.current() });
  registerBoardsHandlers(syncingIpc(ipcMain, 'boards', notify), { project: () => projects.current() });
  registerPalettesHandlers(syncingIpc(ipcMain, 'palettes', notify), { project: () => projects.current() });
  registerCardTemplatesHandlers(syncingIpc(ipcMain, 'cards', notify), { project: () => projects.current() });
  registerItemStylesHandlers(syncingIpc(ipcMain, 'styles', notify), { project: () => projects.current() });
  registerTablesHandlers(syncingIpc(ipcMain, 'tables', notify), { project: () => projects.current() });
  registerAssetsHandlers(syncingIpc(ipcMain, 'assets', notify), {
    project: () => projects.current(),
    dialogs: dialog,
  });
  registerNotesHandlers(syncingIpc(ipcMain, 'notes', notify), {
    project: () => projects.current(),
    dialogs: dialog,
  });
  protocol.handle(ASSET_PROTOCOL, (request) => handleAssetRequest(() => projects.current(), request));
  protocol.handle(PICKER_PROTOCOL, handlePickerRequest);
  const pickerOverlays = new WeakSet<BrowserWindow>();
  const screenPicker = createScreenPicker({
    displays: () =>
      screen
        .getAllDisplays()
        .map((display) => ({ id: display.id, bounds: display.bounds, scaleFactor: display.scaleFactor })),
    sourceIds: async (displays) => {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 0, height: 0 },
      });
      const all = screen.getAllDisplays();
      const ids = new Map<number, string>();
      for (const display of displays) {
        const index = all.findIndex((item) => item.id === display.id);
        const source = sourceForDisplay(sources, display.id, index);
        if (source) ids.set(display.id, source.id);
      }
      return ids;
    },
    cursorDisplayId: () => screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id,
    colourAt: async (display, point) => {
      const source = await screenSource(display, {
        width: Math.round(display.bounds.width * display.scaleFactor),
        height: Math.round(display.bounds.height * display.scaleFactor),
      });
      if (!source || source.thumbnail.isEmpty()) return null;
      const { x, y } = scalePoint(point, source.thumbnail.getSize());
      return hexFromBgra(source.thumbnail.crop({ x, y, width: 1, height: 1 }).toBitmap());
    },
    createWindow: (display: PickerDisplay) => {
      const window = new BrowserWindow({
        ...display.bounds,
        frame: false,
        show: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        hasShadow: false,
        autoHideMenuBar: true,
        enableLargerThanScreen: true,
        transparent: true,
        backgroundColor: '#00000000',
        webPreferences: {
          preload: join(__dirname, '../preload/picker.cjs'),
          contextIsolation: true,
          sandbox: true,
          nodeIntegration: false,
          backgroundThrottling: false,
        },
      });
      pickerOverlays.add(window);
      // Keeps the overlay out of its own screen capture so the loupe samples what is underneath.
      window.setContentProtection(true);
      window.setMenuBarVisibility(false);
      window.setAlwaysOnTop(true, 'screen-saver');
      window.setBounds(display.bounds);
      window.once('ready-to-show', () => {
        window.setBounds(display.bounds);
        window.focus();
      });
      return { ...pickerWindow(window), webContentsId: window.webContents.id };
    },
    ipc: ipcMain,
  });
  registerColourHandlers(ipcMain, { pickScreenColour: screenPicker.pick });
  app.on('browser-window-created', (_event, created) => {
    created.on('closed', () => {
      if (BrowserWindow.getAllWindows().every((window) => pickerOverlays.has(window))) screenPicker.dispose();
    });
  });
  let confirmed = false;
  let guarding = false;
  const confirmThen = (proceed: () => void) => {
    if (guarding) return;
    guarding = true;
    void projects
      .guard()
      .then((ok) => {
        if (!ok) return;
        confirmed = true;
        proceed();
      })
      .finally(() => {
        guarding = false;
      });
  };
  app.on('before-quit', (event) => {
    if (confirmed || !projects.needsSave()) return;
    event.preventDefault();
    confirmThen(() => {
      app.quit();
    });
  });
  app.on('will-quit', () => {
    projects.dispose();
  });

  mainWindow = createMainWindow();
  mainWindow.on('close', (event) => {
    if (confirmed || !projects.needsSave()) return;
    event.preventDefault();
    confirmThen(() => {
      mainWindow?.close();
    });
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
    for (const window of BrowserWindow.getAllWindows()) {
      if (detached.has(window.webContents.id)) window.close();
    }
  });
  logger.info(`Loopy ${appVersion} started`);

  const openFromArgv = async (argv: readonly string[]) => {
    const path = projectPathFromArgv(argv);
    if (!path) return;
    const result = await projects.openFile(path);
    if (result.status !== 'failed') return;
    logger.warn(`Could not open ${path}: ${result.code}`);
    const options = openFailedDialog(language(), path);
    await (mainWindow ? dialog.showMessageBox(mainWindow, options) : dialog.showMessageBox(options));
  };
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    void openFromArgv(argv);
  });
  void openFromArgv(process.argv);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
}

if (primaryInstance) void app.whenReady().then(start);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
