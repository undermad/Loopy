import { vi } from 'vitest';
import { paletteInputSchema, palettePatchSchema, type Palette } from '@shared/colours';
import type { LoopyApi } from '@shared/ipc';

export type PalettesFakeApi = Pick<
  LoopyApi,
  'listPalettes' | 'createPalette' | 'updatePalette' | 'deletePalette'
>;

export function createPalettesFake() {
  const data = { palettes: [] as Palette[], counter: 0 };
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
  const api: PalettesFakeApi = {
    listPalettes: vi.fn(() => Promise.resolve(structuredClone(data.palettes))),
    createPalette: vi.fn((raw: unknown) => {
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
        createdAt: stamp,
        updatedAt: stamp,
      };
      data.palettes.push(palette);
      return Promise.resolve(structuredClone(palette));
    }),
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
      };
      data.palettes = data.palettes.map((item) => (item.id === id ? palette : item));
      return Promise.resolve(structuredClone(palette));
    }),
    deletePalette: vi.fn((id: string) => {
      data.palettes = data.palettes.filter((item) => item.id !== id);
      return Promise.resolve(structuredClone(data.palettes));
    }),
  };
  return { api, data };
}
