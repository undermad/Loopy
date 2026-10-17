import type { AppSettings, ThemePreference } from '@shared/app-settings';
import type { ColorScheme } from '@shared/ipc';
import { THEME_COLOR_KEYS, builtInThemeFor, themeColorVariable, type Theme } from '@shared/theme';

export function resolveTheme(
  preference: ThemePreference,
  system: ColorScheme,
  themes: readonly Theme[],
): Theme {
  const scheme = preference.mode === 'system' ? system : preference.mode;
  const id = scheme === 'dark' ? preference.dark : preference.light;
  return themes.find((theme) => theme.id === id && theme.base === scheme) ?? builtInThemeFor(scheme);
}

export function applyTheme(root: HTMLElement, theme: Theme): void {
  for (const key of THEME_COLOR_KEYS) root.style.setProperty(themeColorVariable(key), theme.colors[key]);
  root.dataset['theme'] = theme.base;
  root.style.colorScheme = theme.base;
}

export function applyTypography(root: HTMLElement, settings: Pick<AppSettings, 'uiFont' | 'fontSize'>): void {
  root.style.setProperty('--font-family', `'${settings.uiFont}', system-ui, sans-serif`);
  root.style.fontSize = `${settings.fontSize}px`;
}
