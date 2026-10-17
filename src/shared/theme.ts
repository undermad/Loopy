import { z } from 'zod';

export const THEME_SCHEMA_VERSION = 1;

export const THEME_COLOR_KEYS = [
  'bg',
  'surface',
  'surfaceRaised',
  'surfaceSunken',
  'fg',
  'fgMuted',
  'border',
  'accent',
  'accentFg',
  'focus',
  'danger',
  'warning',
  'success',
  'selection',
] as const;

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];

export const hexColorSchema = z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i);

export const themeColorsSchema = z.object({
  bg: hexColorSchema,
  surface: hexColorSchema,
  surfaceRaised: hexColorSchema,
  surfaceSunken: hexColorSchema,
  fg: hexColorSchema,
  fgMuted: hexColorSchema,
  border: hexColorSchema,
  accent: hexColorSchema,
  accentFg: hexColorSchema,
  focus: hexColorSchema,
  danger: hexColorSchema,
  warning: hexColorSchema,
  success: hexColorSchema,
  selection: hexColorSchema,
});

export const themeBaseSchema = z.enum(['light', 'dark']);

export const themeSchema = z.object({
  schemaVersion: z.literal(THEME_SCHEMA_VERSION),
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(60),
  base: themeBaseSchema,
  colors: themeColorsSchema,
});

export type ThemeBase = z.infer<typeof themeBaseSchema>;
export type Theme = z.infer<typeof themeSchema>;

export const lightTheme: Theme = {
  schemaVersion: THEME_SCHEMA_VERSION,
  id: 'light',
  name: 'Light',
  base: 'light',
  colors: {
    bg: '#fafafa',
    surface: '#ffffff',
    surfaceRaised: '#ffffff',
    surfaceSunken: '#f0f0f0',
    fg: '#1a1a1a',
    fgMuted: '#5c5c5c',
    border: '#d9d9d9',
    accent: '#4f46e5',
    accentFg: '#ffffff',
    focus: '#4f46e5',
    danger: '#dc2626',
    warning: '#d97706',
    success: '#16a34a',
    selection: '#c7d2fe',
  },
};

export const darkTheme: Theme = {
  schemaVersion: THEME_SCHEMA_VERSION,
  id: 'dark',
  name: 'Dark',
  base: 'dark',
  colors: {
    bg: '#141414',
    surface: '#1f1f1f',
    surfaceRaised: '#262626',
    surfaceSunken: '#0f0f0f',
    fg: '#f0f0f0',
    fgMuted: '#a0a0a0',
    border: '#333333',
    accent: '#818cf8',
    accentFg: '#141414',
    focus: '#818cf8',
    danger: '#f87171',
    warning: '#fbbf24',
    success: '#4ade80',
    selection: '#3730a3',
  },
};

export const builtInThemes: readonly Theme[] = [lightTheme, darkTheme];

export function isBuiltInThemeId(id: string): boolean {
  return builtInThemes.some((theme) => theme.id === id);
}

export function builtInThemeFor(base: ThemeBase): Theme {
  return base === 'dark' ? darkTheme : lightTheme;
}

export function themeColorVariable(key: ThemeColorKey): string {
  return `--color-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}
