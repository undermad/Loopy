import { z } from 'zod';

export const APP_SETTINGS_SCHEMA_VERSION = 2;

export const themeModeSchema = z.enum(['system', 'light', 'dark']);

export const themePreferenceSchema = z.object({
  mode: themeModeSchema.default('system'),
  light: z.string().min(1).default('light'),
  dark: z.string().min(1).default('dark'),
});

export const languageSettingSchema = z.enum(['system', 'en']);

const fieldSchemas = {
  theme: themePreferenceSchema,
  language: languageSettingSchema,
  uiFont: z.string().trim().min(1),
  fontSize: z.number().int().min(10).max(24),
  defaultLayoutId: z.string().min(1),
};

export const appSettingsSchema = z.object({
  schemaVersion: z.literal(APP_SETTINGS_SCHEMA_VERSION),
  theme: fieldSchemas.theme.prefault({}),
  language: fieldSchemas.language.default('system'),
  uiFont: fieldSchemas.uiFont.default('Inter'),
  fontSize: fieldSchemas.fontSize.default(14),
  defaultLayoutId: fieldSchemas.defaultLayoutId.default('default'),
});

export const appSettingsPatchSchema = z.object(fieldSchemas).partial();

export type ThemeMode = z.infer<typeof themeModeSchema>;
export type ThemePreference = z.infer<typeof themePreferenceSchema>;
export type LanguageSetting = z.infer<typeof languageSettingSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type AppSettingsPatch = z.infer<typeof appSettingsPatchSchema>;
