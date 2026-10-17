import { describe, expect, it } from 'vitest';
import { APP_SETTINGS_SCHEMA_VERSION, appSettingsPatchSchema, appSettingsSchema } from '@shared/app-settings';

describe('app settings schema', () => {
  it('fills defaults for a file that only carries the version', () => {
    expect(appSettingsSchema.parse({ schemaVersion: APP_SETTINGS_SCHEMA_VERSION })).toEqual({
      schemaVersion: APP_SETTINGS_SCHEMA_VERSION,
      theme: { mode: 'system', light: 'light', dark: 'dark' },
      language: 'system',
      uiFont: 'Inter',
      fontSize: 14,
      defaultLayoutId: 'default',
    });
  });

  it('fills defaults inside a partial theme preference', () => {
    const parsed = appSettingsSchema.parse({
      schemaVersion: APP_SETTINGS_SCHEMA_VERSION,
      theme: { mode: 'dark' },
    });
    expect(parsed.theme).toEqual({ mode: 'dark', light: 'light', dark: 'dark' });
  });

  it('rejects an unknown mode, a blank font and a font size out of range', () => {
    const valid = { schemaVersion: APP_SETTINGS_SCHEMA_VERSION };
    expect(appSettingsSchema.safeParse({ ...valid, theme: { mode: 'sepia' } }).success).toBe(false);
    expect(appSettingsSchema.safeParse({ ...valid, language: 'xx' }).success).toBe(false);
    expect(appSettingsSchema.safeParse({ ...valid, uiFont: '   ' }).success).toBe(false);
    expect(appSettingsSchema.safeParse({ ...valid, fontSize: 9 }).success).toBe(false);
    expect(appSettingsSchema.safeParse({ ...valid, fontSize: 12.5 }).success).toBe(false);
  });

  it('rejects an unknown schema version', () => {
    expect(appSettingsSchema.safeParse({ schemaVersion: 99 }).success).toBe(false);
  });

  it('accepts a patch without the schema version', () => {
    expect(appSettingsPatchSchema.parse({ fontSize: 16 })).toEqual({ fontSize: 16 });
    expect(appSettingsPatchSchema.safeParse({ schemaVersion: 2 }).success).toBe(true);
  });
});
