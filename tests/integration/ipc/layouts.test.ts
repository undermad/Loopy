import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wrapExchange } from '@shared/exchange';
import { IpcChannel } from '@shared/ipc';
import { LAYOUT_SCHEMA_VERSION, type LayoutPreset } from '@shared/layout';
import { buildWorkspace } from '@shared/layout-presets';
import { registerLayoutsHandlers } from '../../../src/main/ipc/layouts';
import type { FileDialogs } from '../../../src/main/ipc/themes';
import { createLayoutsStore } from '../../../src/main/storage';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-layouts-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

function preset(id: string, name: string): LayoutPreset {
  return { schemaVersion: LAYOUT_SCHEMA_VERSION, id, name, workspaces: [buildWorkspace('design', 'Design')] };
}

function setup(dialogs: Partial<FileDialogs> = {}) {
  const handlers = new Map<string, Handler>();
  const ipc = { handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler)) };
  registerLayoutsHandlers(ipc, {
    store: createLayoutsStore(join(directory, 'layouts')),
    appVersion: '0.1.0',
    dialogs: {
      showSaveDialog: vi.fn(() => Promise.resolve({ canceled: true })),
      showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })),
      ...dialogs,
    },
  });
  return <T>(channel: string, ...args: unknown[]) =>
    Promise.resolve().then(() => handlers.get(channel)?.({}, ...args)) as Promise<T>;
}

describe('layouts IPC handlers', () => {
  it('saves, lists and deletes custom layouts and protects built-in ids', async () => {
    const call = setup();
    await expect(call(IpcChannel.layoutsList)).resolves.toEqual([]);
    await call(IpcChannel.layoutsSave, preset('mine', 'Mine'));
    await expect(call<LayoutPreset[]>(IpcChannel.layoutsList)).resolves.toHaveLength(1);
    await expect(call(IpcChannel.layoutsSave, preset('default', 'Nope'))).rejects.toThrow(/built in/);
    await expect(call(IpcChannel.layoutsDelete, 'planning')).rejects.toThrow(/built in/);
    await call(IpcChannel.layoutsDelete, 'mine');
    await expect(call(IpcChannel.layoutsList)).resolves.toEqual([]);
  });

  it('exports inside the envelope and imports with collision-safe ids', async () => {
    const target = join(directory, 'out.json');
    const mine = preset('mine', 'Mine');
    const open = vi.fn();
    const call = setup({
      showSaveDialog: () => Promise.resolve({ canceled: false, filePath: target }),
      showOpenDialog: open,
    });

    await expect(call(IpcChannel.layoutsExport, mine)).resolves.toEqual({ status: 'exported' });
    const written: unknown = JSON.parse(await readFile(target, 'utf8'));
    expect(written).toEqual(wrapExchange('layout', LAYOUT_SCHEMA_VERSION, '0.1.0', mine));

    open.mockResolvedValueOnce({ canceled: false, filePaths: [target] });
    await expect(call(IpcChannel.layoutsImport)).resolves.toEqual({ status: 'imported', layout: mine });

    open.mockResolvedValueOnce({ canceled: false, filePaths: [target] });
    const again = await call<{ status: string; layout: LayoutPreset }>(IpcChannel.layoutsImport);
    expect(again.layout.id).not.toBe('mine');

    const builtIn = join(directory, 'default.json');
    const content = wrapExchange('layout', LAYOUT_SCHEMA_VERSION, '0.1.0', preset('default', 'D'));
    await writeFile(builtIn, JSON.stringify(content));
    open.mockResolvedValueOnce({ canceled: false, filePaths: [builtIn] });
    const renamed = await call<{ status: string; layout: LayoutPreset }>(IpcChannel.layoutsImport);
    expect(renamed.layout.id).not.toBe('default');

    const invalid = join(directory, 'theme.json');
    await writeFile(invalid, JSON.stringify(wrapExchange('theme', 1, '0.1.0', {})));
    open.mockResolvedValueOnce({ canceled: false, filePaths: [invalid] });
    await expect(call(IpcChannel.layoutsImport)).resolves.toEqual({ status: 'invalid' });
  });
});
