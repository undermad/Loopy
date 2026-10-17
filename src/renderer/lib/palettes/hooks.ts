import { useMemo } from 'react';
import { useStore } from 'zustand';
import type { ColourRef, ColourValue, Palette, PaletteCluster } from '@shared/colours';
import { groupPalettes, type PaletteGroup } from './grouping';
import { palettesStore, resolveColour, resolveRef } from './store';

export function usePalettes(): Palette[] | null {
  return useStore(palettesStore, (state) => state.palettes);
}

export function usePaletteClusters(): PaletteCluster[] | null {
  return useStore(palettesStore, (state) => state.clusters);
}

export function usePaletteGroups(): PaletteGroup<Palette>[] {
  const palettes = useStore(palettesStore, (state) => state.palettes);
  const clusters = useStore(palettesStore, (state) => state.clusters);
  return useMemo(() => groupPalettes(palettes ?? [], clusters ?? []), [palettes, clusters]);
}

export function usePalette(id: string | null): Palette | null {
  return useStore(palettesStore, (state) => state.palettes?.find((item) => item.id === id) ?? null);
}

export function useResolvedColour(value: ColourValue | null | undefined): string | null {
  return useStore(palettesStore, (state) => resolveColour(value, state.palettes));
}

export function useColourFromRef(hex: string, ref: ColourRef | null | undefined): string {
  return useStore(palettesStore, (state) => resolveRef(ref, state.palettes) ?? hex);
}
