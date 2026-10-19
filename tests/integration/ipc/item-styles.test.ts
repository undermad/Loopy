import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IpcChannel } from '@shared/ipc';
import type { ItemStylePreset } from '@shared/item-styles';
import { registerItemStylesHandlers } from '../../../src/main/ipc/item-styles';
import { createProject, type ProjectDatabase } from '../../../src/main/storage';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

let directory: string;
let project: ProjectDatabase;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-styles-'));
  project = await createProject(join(directory, 'demo.loopy'), 'Demo');
});

afterEach(async () => {
  project.close();
  await rm(directory, { recursive: true, force: true });
});

function setup(open = true) {
  const handlers = new Map<string, Handler>();
  const ipc = { handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler)) };
  registerItemStylesHandlers(ipc, { project: () => (open ? project : null) });
  return <T>(channel: string, ...args: unknown[]) =>
    Promise.resolve().then(() => handlers.get(channel)?.({}, ...args)) as Promise<T>;
}

describe('item style presets IPC handlers', () => {
  it('creates, lists, renames, restyles and deletes presets', async () => {
    const call = setup();
    await expect(call(IpcChannel.itemStylesList)).resolves.toEqual([]);

    const warning = await call<ItemStylePreset>(IpcChannel.itemStylesCreate, {
      name: 'Warning',
      style: { fill: { hex: '#fde68a', ref: null }, fontWeight: 'bold', italic: true },
    });
    expect(warning).toMatchObject({ name: 'Warning', style: { fontWeight: 'bold', italic: true } });
    await call(IpcChannel.itemStylesCreate, { name: 'Calm', style: {} });

    const list = await call<ItemStylePreset[]>(IpcChannel.itemStylesList);
    expect(list.map((preset) => preset.name)).toEqual(['Calm', 'Warning']);

    const renamed = await call<ItemStylePreset>(IpcChannel.itemStylesUpdate, warning.id, {
      name: 'Alert',
      style: { shadow: true, shadowSize: 'lg' },
    });
    expect(renamed).toMatchObject({ name: 'Alert', style: { shadow: true, shadowSize: 'lg' } });
    expect(renamed.style).not.toHaveProperty('italic');

    const left = await call<ItemStylePreset[]>(IpcChannel.itemStylesDelete, warning.id);
    expect(left.map((preset) => preset.name)).toEqual(['Calm']);
  });

  it('refuses bad input and unknown presets', async () => {
    const call = setup();
    await expect(call(IpcChannel.itemStylesCreate, { name: '', style: {} })).rejects.toThrow();
    await expect(call(IpcChannel.itemStylesCreate, { name: 'X', style: { opacity: 5 } })).rejects.toThrow();
    await expect(call(IpcChannel.itemStylesUpdate, 'missing', { name: 'Y' })).rejects.toThrow(
      /Unknown item style/,
    );
    await expect(call(IpcChannel.itemStylesDelete, '')).rejects.toThrow();
  });

  it('needs an open project', async () => {
    const call = setup(false);
    await expect(call(IpcChannel.itemStylesList)).rejects.toThrow();
  });
});
