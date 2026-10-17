import { describe, expect, it } from 'vitest';
import { APP_SETTINGS_SCHEMA_VERSION, appSettingsSchema } from '@shared/app-settings';

describe('app settings schema', () => {
  it('fills defaults for a file that only carries the version', () => {
    expect(appSettingsSchema.parse({ schemaVersion: APP_SETTINGS_SCHEMA_VERSION })).toEqual({
      schemaVersion: APP_SETTINGS_SCHEMA_VERSION,
      theme: 'system',
      uiFont: 'Inter',
      fontSize: 14,
    });
  });

  it('rejects an unknown theme, a blank font and a font size out of range', () => {
    const valid = { schemaVersion: APP_SETTINGS_SCHEMA_VERSION };
    expect(appSettingsSchema.safeParse({ ...valid, theme: 'sepia' }).success).toBe(false);
    expect(appSettingsSchema.safeParse({ ...valid, uiFont: '   ' }).success).toBe(false);
    expect(appSettingsSchema.safeParse({ ...valid, fontSize: 9 }).success).toBe(false);
    expect(appSettingsSchema.safeParse({ ...valid, fontSize: 12.5 }).success).toBe(false);
  });

  it('rejects an unknown schema version', () => {
    expect(appSettingsSchema.safeParse({ schemaVersion: 99 }).success).toBe(false);
  });
});
