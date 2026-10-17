import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Palette } from '@shared/colours';
import { IpcChannel } from '@shared/ipc';
import { registerPalettesHandlers } from '../../../src/main/ipc/palettes';
import { createProject, type ProjectDatabase } from '../../../src/main/storage';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

let directory: string;
let project: ProjectDatabase;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-palettes-'));
  project = await createProject(join(directory, 'demo.loopy'), 'Demo');
});

afterEach(async () => {
  project.close();
  await rm(directory, { recursive: true, force: true });
});

function setup(open = true) {
  const handlers = new Map<string, Handler>();
  const ipc = { handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler)) };
  registerPalettesHandlers(ipc, { project: () => (open ? project : null) });
  return <T>(channel: string, ...args: unknown[]) =>
    Promise.resolve().then(() => handlers.get(channel)?.({}, ...args)) as Promise<T>;
}

const colours = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'].map((hex) => ({ hex }));

describe('palettes IPC handlers', () => {
  it('creates, lists, updates and deletes palettes with their colours in order', async () => {
    const call = setup();
    await expect(call(IpcChannel.palettesList)).resolves.toEqual([]);

    const palette = await call<Palette>(IpcChannel.palettesCreate, { name: 'Sunset', colours });
    expect(palette).toMatchObject({ name: 'Sunset', harmony: 'analogous', baseIndex: 0, source: 'wheel' });
    expect(palette.colours.map((colour) => colour.hex)).toEqual(colours.map((colour) => colour.hex));
    expect(palette.colours.every((colour) => colour.id.length > 0 && colour.name === '')).toBe(true);

    const second = palette.colours[1];
    const updated = await call<Palette>(IpcChannel.palettesUpdate, palette.id, {
      name: 'Dusk',
      harmony: 'triad',
      baseIndex: 0,
      colours: [{ id: second?.id, name: 'Leaf', hex: '#00AA00' }, { hex: '#123456' }],
    });
    expect(updated.name).toBe('Dusk');
    expect(updated.harmony).toBe('triad');
    expect(updated.baseIndex).toBe(0);
    expect(updated.colours).toHaveLength(2);
    expect(updated.colours[0]).toMatchObject({ id: second?.id, name: 'Leaf', hex: '#00aa00' });
    expect(updated.colours[1]?.hex).toBe('#123456');

    const clamped = await call<Palette>(IpcChannel.palettesUpdate, palette.id, { baseIndex: 9 });
    expect(clamped.baseIndex).toBe(1);

    await expect(call(IpcChannel.palettesUpdate, palette.id, { colours: [] })).rejects.toThrow();
    await expect(
      call(IpcChannel.palettesUpdate, palette.id, { colours: [{ hex: 'red' }] }),
    ).rejects.toThrow();
    await expect(call(IpcChannel.palettesUpdate, 'missing', { name: 'x' })).rejects.toThrow(
      /Unknown palette/,
    );

    const list = await call<Palette[]>(IpcChannel.palettesList);
    expect(list.map((item) => item.name)).toEqual(['Dusk']);
    await expect(call(IpcChannel.palettesDelete, palette.id)).resolves.toEqual([]);
  });

  it('refuses every channel when no project is open', async () => {
    const call = setup(false);
    await expect(call(IpcChannel.palettesList)).rejects.toThrow(/No project/);
  });
});
