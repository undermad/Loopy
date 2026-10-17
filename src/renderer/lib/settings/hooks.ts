import { useStore } from 'zustand';
import type { AppSettings } from '@shared/app-settings';
import { settingsStore } from './store';

export function useSettings(): AppSettings {
  const settings = useStore(settingsStore, (state) => state.settings);
  if (!settings) throw new Error('Settings are not loaded');
  return settings;
}

export function useSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return useSettings()[key];
}
