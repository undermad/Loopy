import { useStore } from 'zustand';
import type { ColorScheme } from '@shared/ipc';
import type { Theme } from '@shared/theme';
import { useSettings } from '@renderer/lib/settings';
import { resolveTheme } from './apply';
import { themeStore } from './store';

export function useThemes(): readonly Theme[] {
  return useStore(themeStore, (state) => state.themes);
}

export function useSystemScheme(): ColorScheme {
  return useStore(themeStore, (state) => state.system);
}

export function useActiveTheme(): Theme {
  const settings = useSettings();
  const themes = useThemes();
  const system = useSystemScheme();
  return resolveTheme(settings.theme, system, themes);
}
