import { z } from 'zod';

export const APP_SETTINGS_SCHEMA_VERSION = 3;

export const themeModeSchema = z.enum(['system', 'light', 'dark']);

export const themePreferenceSchema = z.object({
  mode: themeModeSchema.default('system'),
  light: z.string().min(1).default('light'),
  dark: z.string().min(1).default('dark'),
});

export const languageSettingSchema = z.enum(['system', 'en']);

export const boardPreferencesSchema = z.object({
  grid: z.boolean().default(true),
  snap: z.boolean().default(false),
  minimap: z.boolean().default(false),
  wheel: z.enum(['zoom', 'pan']).default('zoom'),
  quickButtons: z.boolean().default(true),
});

export const assetsPreferencesSchema = z.object({
  layout: z.enum(['grid', 'list']).default('grid'),
  details: z.boolean().default(true),
});

export const editorPreferencesSchema = z.object({
  board: boardPreferencesSchema.prefault({}),
  assets: assetsPreferencesSchema.prefault({}),
});

const fieldSchemas = {
  theme: themePreferenceSchema,
  language: languageSettingSchema,
  uiFont: z.string().trim().min(1),
  fontSize: z.number().int().min(10).max(24),
  defaultLayoutId: z.string().min(1),
  editors: editorPreferencesSchema,
};

export const appSettingsSchema = z.object({
  schemaVersion: z.literal(APP_SETTINGS_SCHEMA_VERSION),
  theme: fieldSchemas.theme.prefault({}),
  language: fieldSchemas.language.default('system'),
  uiFont: fieldSchemas.uiFont.default('Inter'),
  fontSize: fieldSchemas.fontSize.default(14),
  defaultLayoutId: fieldSchemas.defaultLayoutId.default('default'),
  editors: fieldSchemas.editors.prefault({}),
});

export const appSettingsPatchSchema = z.object(fieldSchemas).partial();

export type ThemeMode = z.infer<typeof themeModeSchema>;
export type ThemePreference = z.infer<typeof themePreferenceSchema>;
export type LanguageSetting = z.infer<typeof languageSettingSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type AppSettingsPatch = z.infer<typeof appSettingsPatchSchema>;
export type EditorPreferences = z.infer<typeof editorPreferencesSchema>;
