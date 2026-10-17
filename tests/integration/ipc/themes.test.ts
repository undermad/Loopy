import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wrapExchange } from '@shared/exchange';
import { IpcChannel } from '@shared/ipc';
import { THEME_SCHEMA_VERSION, builtInThemes, lightTheme } from '@shared/theme';
import { registerThemesHandlers, type FileDialogs } from '../../../src/main/ipc/themes';
import { createThemesStore } from '../../../src/main/storage';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

function fakeIpc() {
  const handlers = new Map<string, Handler>();
  return {
    handle: vi.fn((channel: string, handler: Handler) => {
      handlers.set(channel, handler);
    }),
    call: (channel: string, ...args: unknown[]) => Promise.resolve(handlers.get(channel)?.({}, ...args)),
  };
}

let directory: string;
const sepia = { ...lightTheme, id: 'sepia', name: 'Sepia' };

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-themes-ipc-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

function setup(dialogs: Partial<FileDialogs> = {}) {
  const ipc = fakeIpc();
  const store = createThemesStore(join(directory, 'themes'));
  registerThemesHandlers(ipc, {
    store,
    appVersion: '0.1.0',
    dialogs: {
      showSaveDialog: vi.fn(() => Promise.resolve({ canceled: true })),
      showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })),
      ...dialogs,
    },
  });
  return { ipc, store };
}

describe('themes IPC handlers', () => {
  it('lists built-in themes first, saves custom ones and refuses to touch built-ins', async () => {
    const { ipc } = setup();

    await expect(ipc.call(IpcChannel.themesList)).resolves.toEqual(builtInThemes);
    await ipc.call(IpcChannel.themesSave, sepia);
    await expect(ipc.call(IpcChannel.themesList)).resolves.toHaveLength(3);

    await expect(ipc.call(IpcChannel.themesSave, { ...sepia, id: 'light' })).rejects.toThrow(/built in/);
    await expect(ipc.call(IpcChannel.themesDelete, 'dark')).rejects.toThrow(/built in/);
    await ipc.call(IpcChannel.themesDelete, 'sepia');
    await expect(ipc.call(IpcChannel.themesList)).resolves.toHaveLength(2);
  });

  it('exports a theme inside the exchange envelope', async () => {
    const target = join(directory, 'out.json');
    const { ipc } = setup({ showSaveDialog: () => Promise.resolve({ canceled: false, filePath: target }) });

    await expect(ipc.call(IpcChannel.themesExport, 'dark')).resolves.toEqual({ status: 'exported' });
    const written: unknown = JSON.parse(await readFile(target, 'utf8'));
    expect(written).toEqual(wrapExchange('theme', THEME_SCHEMA_VERSION, '0.1.0', builtInThemes[1]));
  });

  it('imports a valid envelope, renames colliding ids and rejects other files', async () => {
    const valid = join(directory, 'sepia.json');
    await writeFile(
      valid,
      JSON.stringify(wrapExchange('theme', THEME_SCHEMA_VERSION, '0.1.0', sepia)),
      'utf8',
    );
    const colliding = join(directory, 'light.json');
    await writeFile(
      colliding,
      JSON.stringify(wrapExchange('theme', THEME_SCHEMA_VERSION, '0.1.0', lightTheme)),
      'utf8',
    );
    const invalid = join(directory, 'invalid.json');
    await writeFile(invalid, JSON.stringify({ hello: 'world' }), 'utf8');

    const open = vi.fn();
    const { ipc } = setup({ showOpenDialog: open });

    open.mockResolvedValueOnce({ canceled: false, filePaths: [valid] });
    await expect(ipc.call(IpcChannel.themesImport)).resolves.toEqual({ status: 'imported', theme: sepia });

    open.mockResolvedValueOnce({ canceled: false, filePaths: [colliding] });
    const renamed = (await ipc.call(IpcChannel.themesImport)) as { status: string; theme: { id: string } };
    expect(renamed.status).toBe('imported');
    expect(renamed.theme.id).not.toBe('light');

    open.mockResolvedValueOnce({ canceled: false, filePaths: [invalid] });
    await expect(ipc.call(IpcChannel.themesImport)).resolves.toEqual({ status: 'invalid' });

    open.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    await expect(ipc.call(IpcChannel.themesImport)).resolves.toEqual({ status: 'cancelled' });
  });
});
