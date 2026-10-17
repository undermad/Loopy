import { z } from 'zod';

export const APP_SETTINGS_SCHEMA_VERSION = 1;

export const themeSchema = z.enum(['system', 'light', 'dark']);

export const appSettingsSchema = z.object({
  schemaVersion: z.literal(APP_SETTINGS_SCHEMA_VERSION),
  theme: themeSchema.default('system'),
  uiFont: z.string().trim().min(1).default('Inter'),
  fontSize: z.number().int().min(10).max(24).default(14),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;
