import { describe, expect, it } from 'vitest';
import {
  THEME_COLOR_KEYS,
  builtInThemeFor,
  builtInThemes,
  isBuiltInThemeId,
  themeColorVariable,
  themeSchema,
} from '@shared/theme';

describe('theme schema', () => {
  it('accepts both built-in themes', () => {
    for (const theme of builtInThemes) expect(themeSchema.parse(theme)).toEqual(theme);
  });

  it('requires a hex colour for every key', () => {
    const [light] = builtInThemes;
    expect(light).toBeDefined();
    for (const key of THEME_COLOR_KEYS) {
      const broken = { ...light, colors: { ...light?.colors, [key]: 'red' } };
      expect(themeSchema.safeParse(broken).success).toBe(false);
    }
  });

  it('maps colour keys to the custom property names used in tokens.scss', () => {
    expect(themeColorVariable('bg')).toBe('--color-bg');
    expect(themeColorVariable('surfaceRaised')).toBe('--color-surface-raised');
    expect(themeColorVariable('accentFg')).toBe('--color-accent-fg');
  });

  it('knows the built-in ids and the fallback per base', () => {
    expect(isBuiltInThemeId('light')).toBe(true);
    expect(isBuiltInThemeId('sepia')).toBe(false);
    expect(builtInThemeFor('dark').id).toBe('dark');
  });
});
