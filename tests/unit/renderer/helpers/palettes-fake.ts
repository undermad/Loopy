import { vi } from 'vitest';
import {
  paletteClusterInputSchema,
  paletteClusterPatchSchema,
  paletteInputSchema,
  palettePatchSchema,
  type Palette,
  type PaletteCluster,
} from '@shared/colours';
import type { LoopyApi } from '@shared/ipc';

export type PalettesFakeApi = Pick<
  LoopyApi,
  | 'listPalettes'
  | 'createPalette'
  | 'updatePalette'
  | 'deletePalette'
  | 'listPaletteClusters'
  | 'createPaletteCluster'
  | 'updatePaletteCluster'
  | 'deletePaletteCluster'
>;

export function createPalettesFake() {
  const data = { palettes: [] as Palette[], clusters: [] as PaletteCluster[], counter: 0 };
  const stamp = '2026-10-17T09:00:00.000Z';
  const nextId = (prefix: string) => {
    data.counter += 1;
    return `${prefix}-${String(data.counter)}`;
  };
  const find = (id: string): Palette => {
    const palette = data.palettes.find((item) => item.id === id);
    if (!palette) throw new Error(`Unknown palette ${id}`);
    return palette;
  };
  const nextPosition = (clusterId: string | null) =>
    clusterId
      ? Math.max(
          -1,
          ...data.palettes.filter((item) => item.clusterId === clusterId).map((item) => item.clusterPosition),
        ) + 1
      : 0;
  const library = () =>
    Promise.resolve(structuredClone({ palettes: data.palettes, clusters: data.clusters }));
  const insert = (raw: unknown): Palette => {
    const input = paletteInputSchema.parse(raw);
    const palette: Palette = {
      id: nextId('palette'),
      name: input.name,
      harmony: input.harmony,
      baseIndex: Math.min(input.baseIndex, input.colours.length - 1),
      source: input.source,
      colours: input.colours.map((colour) => ({
        id: colour.id ?? nextId('colour'),
        name: colour.name,
        hex: colour.hex.toLowerCase(),
      })),
      clusterId: input.clusterId,
      clusterPosition: nextPosition(input.clusterId),
      createdAt: stamp,
      updatedAt: stamp,
    };
    data.palettes.push(palette);
    return palette;
  };
  const api: PalettesFakeApi = {
    listPalettes: vi.fn(() => Promise.resolve(structuredClone(data.palettes))),
    createPalette: vi.fn((raw: unknown) => Promise.resolve(structuredClone(insert(raw)))),
    updatePalette: vi.fn((id: string, raw: unknown) => {
      const patch = palettePatchSchema.parse(raw);
      const current = find(id);
      const colours = patch.colours
        ? patch.colours.map((colour) => ({
            id: colour.id ?? nextId('colour'),
            name: colour.name,
            hex: colour.hex.toLowerCase(),
          }))
        : current.colours;
      const palette: Palette = {
        ...current,
        name: patch.name ?? current.name,
        harmony: patch.harmony ?? current.harmony,
        baseIndex: Math.min(patch.baseIndex ?? current.baseIndex, colours.length - 1),
        colours,
        ...(patch.clusterId !== undefined && patch.clusterId !== current.clusterId
          ? { clusterId: patch.clusterId, clusterPosition: nextPosition(patch.clusterId) }
          : {}),
      };
      data.palettes = data.palettes.map((item) => (item.id === id ? palette : item));
      return Promise.resolve(structuredClone(palette));
    }),
    deletePalette: vi.fn((id: string) => {
      data.palettes = data.palettes.filter((item) => item.id !== id);
      return Promise.resolve(structuredClone(data.palettes));
    }),
    listPaletteClusters: vi.fn(() => Promise.resolve(structuredClone(data.clusters))),
    createPaletteCluster: vi.fn((raw: unknown) => {
      const input = paletteClusterInputSchema.parse(raw);
      const cluster: PaletteCluster = {
        id: nextId('cluster'),
        name: input.name,
        createdAt: stamp,
        updatedAt: stamp,
      };
      data.clusters.push(cluster);
      for (const paletteId of input.paletteIds) {
        const palette = find(paletteId);
        const moved = { ...palette, clusterId: cluster.id, clusterPosition: nextPosition(cluster.id) };
        data.palettes = data.palettes.map((item) => (item.id === paletteId ? moved : item));
      }
      for (const palette of input.palettes) insert({ ...palette, clusterId: cluster.id });
      return library();
    }),
    updatePaletteCluster: vi.fn((id: string, raw: unknown) => {
      const patch = paletteClusterPatchSchema.parse(raw);
      const cluster = data.clusters.find((item) => item.id === id);
      if (!cluster) throw new Error(`Unknown cluster ${id}`);
      const next = { ...cluster, name: patch.name };
      data.clusters = data.clusters.map((item) => (item.id === id ? next : item));
      return Promise.resolve(structuredClone(next));
    }),
    deletePaletteCluster: vi.fn((id: string, withPalettes: boolean) => {
      data.palettes = withPalettes
        ? data.palettes.filter((item) => item.clusterId !== id)
        : data.palettes.map((item) =>
            item.clusterId === id ? { ...item, clusterId: null, clusterPosition: 0 } : item,
          );
      data.clusters = data.clusters.filter((item) => item.id !== id);
      return library();
    }),
  };
  return { api, data };
}
