import { useStore } from 'zustand';
import type { Asset, AssetsSnapshot } from '@shared/assets';
import { EMPTY_ASSETS, assetsStore } from './store';

export function useAssetsSnapshot(): AssetsSnapshot {
  return useStore(assetsStore, (state) => state.snapshot ?? EMPTY_ASSETS);
}

export function useAssetsLoaded(): boolean {
  return useStore(assetsStore, (state) => state.snapshot !== null);
}

export function useAsset(id: string | null): Asset | null {
  return useStore(assetsStore, (state) => state.snapshot?.assets.find((asset) => asset.id === id) ?? null);
}
