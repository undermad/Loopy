import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { z } from 'zod';
import {
  harmonySchema,
  paletteColourSchema,
  paletteSchema,
  paletteSourceSchema,
  type Palette,
  type PaletteInput,
} from '@shared/colours';

export const NEW_PALETTE_KEY = 'new';

export const paletteDraftSchema = z.object({
  id: z.string().min(1).nullable(),
  name: z.string().max(80),
  harmony: harmonySchema,
  baseIndex: z.number().int().nonnegative(),
  source: paletteSourceSchema,
  colours: z.array(paletteColourSchema).min(1).max(12),
});

export type PaletteDraft = z.infer<typeof paletteDraftSchema>;
export type PaletteDrafts = Record<string, PaletteDraft>;

export const draftsStore = createStore<{ drafts: PaletteDrafts }>(() => ({ drafts: {} }));

export function setDraft(key: string, draft: PaletteDraft): void {
  draftsStore.setState((state) => ({ drafts: { ...state.drafts, [key]: draft } }));
}

export function patchDraft(key: string, patch: Partial<PaletteDraft>): void {
  const draft = draftsStore.getState().drafts[key];
  if (draft) setDraft(key, { ...draft, ...patch });
}

export function removeDraft(key: string): void {
  draftsStore.setState((state) => {
    const { [key]: _removed, ...rest } = state.drafts;
    return { drafts: rest };
  });
}

export function clearDrafts(): void {
  draftsStore.setState({ drafts: {} });
}

export function useDrafts(): PaletteDrafts {
  return useStore(draftsStore, (state) => state.drafts);
}

export function draftFromPalette(palette: Palette): PaletteDraft {
  return {
    id: palette.id,
    name: palette.name,
    harmony: palette.harmony,
    baseIndex: palette.baseIndex,
    source: palette.source,
    colours: palette.colours.map((colour) => ({ ...colour })),
  };
}

export function newDraft(name: string, hexes: string[]): PaletteDraft {
  return {
    id: null,
    name,
    harmony: 'analogous',
    baseIndex: 0,
    source: 'wheel',
    colours: hexes.map((hex) => ({ id: crypto.randomUUID(), name: '', hex })),
  };
}

export function draftToInput(draft: PaletteDraft): PaletteInput {
  return {
    name: draft.name.trim() || 'Palette',
    harmony: draft.harmony,
    baseIndex: draft.baseIndex,
    source: draft.source,
    colours: draft.colours.map((colour) => ({ id: colour.id, name: colour.name, hex: colour.hex })),
  };
}

export function paletteView(draft: PaletteDraft, stored: Palette | null): Palette {
  const stamp = stored?.createdAt ?? new Date(0).toISOString();
  return paletteSchema.parse({
    id: draft.id ?? NEW_PALETTE_KEY,
    name: draft.name.trim() || 'Palette',
    harmony: draft.harmony,
    baseIndex: Math.min(draft.baseIndex, draft.colours.length - 1),
    source: draft.source,
    colours: draft.colours,
    clusterId: stored?.clusterId ?? null,
    clusterPosition: stored?.clusterPosition ?? 0,
    createdAt: stamp,
    updatedAt: stored?.updatedAt ?? stamp,
  });
}
