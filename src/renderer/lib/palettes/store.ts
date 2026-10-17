import { createStore } from 'zustand/vanilla';
import type { ColourRef, ColourValue, Palette, PaletteInput, PalettePatch } from '@shared/colours';
import type { LoopyApi } from '@shared/ipc';
import { subscribeCurrentProject } from '@renderer/lib/project';
import { clearDrafts } from './drafts';

export type PalettesApi = Pick<
  LoopyApi,
  'listPalettes' | 'createPalette' | 'updatePalette' | 'deletePalette'
>;

export interface PalettesState {
  palettes: Palette[] | null;
  api: PalettesApi | null;
}

export const palettesStore = createStore<PalettesState>(() => ({ palettes: null, api: null }));

function requireApi(): PalettesApi {
  const { api } = palettesStore.getState();
  if (!api) throw new Error('Palettes are not loaded');
  return api;
}

let loadToken = 0;

export async function loadPalettes(): Promise<Palette[]> {
  loadToken += 1;
  const token = loadToken;
  const palettes = await requireApi().listPalettes();
  if (token === loadToken) palettesStore.setState({ palettes });
  return palettes;
}

export async function bootPalettes(api: PalettesApi, hasProject: boolean): Promise<void> {
  palettesStore.setState({ api });
  if (hasProject) await loadPalettes();
  subscribeCurrentProject((project) => {
    palettesStore.setState({ palettes: null });
    clearDrafts();
    if (project) void loadPalettes();
  });
}

function store(palette: Palette): void {
  loadToken += 1;
  const { palettes } = palettesStore.getState();
  const list = palettes ?? [];
  const exists = list.some((item) => item.id === palette.id);
  palettesStore.setState({
    palettes: exists ? list.map((item) => (item.id === palette.id ? palette : item)) : [...list, palette],
  });
}

export async function createPalette(input: PaletteInput): Promise<Palette> {
  const palette = await requireApi().createPalette(input);
  store(palette);
  return palette;
}

export async function updatePalette(id: string, patch: PalettePatch): Promise<Palette> {
  const palette = await requireApi().updatePalette(id, patch);
  store(palette);
  return palette;
}

export async function deletePalette(id: string): Promise<Palette[]> {
  const palettes = await requireApi().deletePalette(id);
  loadToken += 1;
  palettesStore.setState({ palettes });
  return palettes;
}

export async function duplicatePalette(id: string, name: string): Promise<Palette | null> {
  const source = palettesStore.getState().palettes?.find((item) => item.id === id);
  if (!source) return null;
  return createPalette({
    name,
    harmony: source.harmony,
    baseIndex: source.baseIndex,
    source: source.source,
    colours: source.colours.map((colour) => ({ name: colour.name, hex: colour.hex })),
  });
}

export function findPalette(id: string): Palette | null {
  return palettesStore.getState().palettes?.find((item) => item.id === id) ?? null;
}

export function resolveRef(ref: ColourRef | null | undefined, palettes: Palette[] | null): string | null {
  if (!ref || !palettes) return null;
  const palette = palettes.find((item) => item.id === ref.paletteId);
  return palette?.colours.find((colour) => colour.id === ref.colourId)?.hex ?? null;
}

export function resolveColour(
  value: ColourValue | null | undefined,
  palettes: Palette[] | null,
): string | null {
  if (!value) return null;
  return resolveRef(value.ref, palettes) ?? value.hex;
}

export function resetPalettesStore(): void {
  palettesStore.setState({ palettes: null, api: null });
  clearDrafts();
}
