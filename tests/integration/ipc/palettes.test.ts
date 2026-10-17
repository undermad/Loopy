import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Palette, PaletteCluster, PaletteLibrary } from '@shared/colours';
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

  it('creates clusters from existing and new palettes, keeps their order and moves palettes between them', async () => {
    const call = setup();
    const fire = await call<Palette>(IpcChannel.palettesCreate, {
      name: 'Fire',
      harmony: 'monochromatic',
      colours,
    });
    expect(fire).toMatchObject({ clusterId: null, clusterPosition: 0 });

    const library = await call<PaletteLibrary>(IpcChannel.paletteClustersCreate, {
      name: 'Magic',
      paletteIds: [fire.id],
      palettes: [
        { name: 'Water', harmony: 'monochromatic', colours },
        { name: 'Lightning', colours },
      ],
    });
    const [magic] = library.clusters;
    expect(magic?.name).toBe('Magic');
    const members = library.palettes
      .filter((palette) => palette.clusterId === magic?.id)
      .sort((a, b) => a.clusterPosition - b.clusterPosition)
      .map((palette) => [palette.name, palette.clusterPosition]);
    expect(members).toEqual([
      ['Fire', 0],
      ['Water', 1],
      ['Lightning', 2],
    ]);
    await expect(call<PaletteCluster[]>(IpcChannel.paletteClustersList)).resolves.toHaveLength(1);

    const extra = await call<Palette>(IpcChannel.palettesCreate, {
      name: 'Earth',
      colours,
      clusterId: magic?.id,
    });
    expect(extra).toMatchObject({ clusterId: magic?.id, clusterPosition: 3 });
    await expect(
      call(IpcChannel.palettesCreate, { name: 'Lost', colours, clusterId: 'missing' }),
    ).rejects.toThrow(/Unknown palette cluster/);

    const renamed = await call<PaletteCluster>(IpcChannel.paletteClustersUpdate, magic?.id, {
      name: 'Spells',
    });
    expect(renamed.name).toBe('Spells');
    await expect(call(IpcChannel.paletteClustersUpdate, magic?.id, { name: ' ' })).rejects.toThrow();
    await expect(call(IpcChannel.paletteClustersUpdate, 'missing', { name: 'x' })).rejects.toThrow(
      /Unknown palette cluster/,
    );

    const second = await call<PaletteLibrary>(IpcChannel.paletteClustersCreate, { name: 'Tech' });
    const tech = second.clusters.find((cluster) => cluster.name === 'Tech');
    const moved = await call<Palette>(IpcChannel.palettesUpdate, fire.id, { clusterId: tech?.id });
    expect(moved).toMatchObject({ clusterId: tech?.id, clusterPosition: 0, name: 'Fire' });
    const loose = await call<Palette>(IpcChannel.palettesUpdate, fire.id, { clusterId: null });
    expect(loose).toMatchObject({ clusterId: null, clusterPosition: 0 });
    await expect(call(IpcChannel.palettesUpdate, fire.id, { clusterId: 'missing' })).rejects.toThrow(
      /Unknown palette cluster/,
    );

    const kept = await call<PaletteLibrary>(IpcChannel.paletteClustersDelete, tech?.id, false);
    expect(kept.clusters.map((cluster) => cluster.name)).toEqual(['Spells']);
    const removed = await call<PaletteLibrary>(IpcChannel.paletteClustersDelete, magic?.id, true);
    expect(removed.clusters).toEqual([]);
    expect(removed.palettes.map((palette) => palette.name)).toEqual(['Fire']);
    await expect(call(IpcChannel.paletteClustersDelete, magic?.id, 'yes')).rejects.toThrow();
    await expect(
      call(IpcChannel.paletteClustersCreate, { name: 'Ghost', paletteIds: ['missing'] }),
    ).rejects.toThrow(/Unknown palette/);
    await expect(call<PaletteCluster[]>(IpcChannel.paletteClustersList)).resolves.toEqual([]);
  });

  it('upgrades an older project so its palettes start ungrouped', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const { migrateDatabase } = await import('../../../src/main/storage/sql-migrations');
    const { projectMigrations } = await import('../../../src/main/storage/project-migrations');
    const db = new DatabaseSync(join(directory, 'legacy.loopy'));
    db.exec('PRAGMA foreign_keys = ON');
    migrateDatabase(db, projectMigrations.slice(0, -1));
    db.prepare(
      `INSERT INTO palettes (id, name, harmony, base_index, source, created_at, updated_at)
       VALUES ('p1', 'Old', 'analogous', 0, 'wheel', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    ).run();
    migrateDatabase(db, projectMigrations);
    const row = db
      .prepare('SELECT cluster_id AS clusterId, cluster_position AS clusterPosition FROM palettes')
      .get();
    const clusters = db.prepare('SELECT COUNT(*) AS count FROM palette_clusters').get() as { count: number };
    db.close();
    expect(row).toEqual({ clusterId: null, clusterPosition: 0 });
    expect(clusters.count).toBe(0);
  });

  it('refuses every channel when no project is open', async () => {
    const call = setup(false);
    await expect(call(IpcChannel.palettesList)).rejects.toThrow(/No project/);
    await expect(call(IpcChannel.paletteClustersList)).rejects.toThrow(/No project/);
  });
});
