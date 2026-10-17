import { createStore } from 'zustand/vanilla';
import type { ColorScheme, LoopyApi } from '@shared/ipc';
import { builtInThemes, type Theme } from '@shared/theme';

export type ThemeApi = Pick<
  LoopyApi,
  | 'getNativeTheme'
  | 'onNativeThemeChanged'
  | 'listThemes'
  | 'saveTheme'
  | 'deleteTheme'
  | 'exportTheme'
  | 'importTheme'
>;

interface ThemeState {
  system: ColorScheme;
  themes: readonly Theme[];
  api: ThemeApi | null;
}

export const themeStore = createStore<ThemeState>(() => ({
  system: 'light',
  themes: builtInThemes,
  api: null,
}));

export async function bootTheme(api: ThemeApi): Promise<void> {
  const [system, themes] = await Promise.all([api.getNativeTheme(), api.listThemes()]);
  themeStore.setState({ system, themes, api });
  api.onNativeThemeChanged((next) => {
    themeStore.setState({ system: next });
  });
}

function requireApi(): ThemeApi {
  const { api } = themeStore.getState();
  if (!api) throw new Error('Themes are not loaded');
  return api;
}

async function refresh(api: ThemeApi): Promise<void> {
  themeStore.setState({ themes: await api.listThemes() });
}

export async function saveTheme(theme: Theme): Promise<Theme> {
  const api = requireApi();
  const saved = await api.saveTheme(theme);
  await refresh(api);
  return saved;
}

export async function deleteTheme(id: string): Promise<void> {
  const api = requireApi();
  await api.deleteTheme(id);
  await refresh(api);
}

export function exportTheme(id: string) {
  return requireApi().exportTheme(id);
}

export async function importTheme() {
  const api = requireApi();
  const result = await api.importTheme();
  if (result.status === 'imported') await refresh(api);
  return result;
}

export function resetThemeStore(): void {
  themeStore.setState({ system: 'light', themes: builtInThemes, api: null });
}
