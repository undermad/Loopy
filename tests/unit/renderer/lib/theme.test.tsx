import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { darkTheme, lightTheme } from '@shared/theme';
import { applyTheme, applyTypography, resolveTheme, useActiveTheme, useThemes } from '@renderer/lib/theme';
import { updateSettings } from '@renderer/lib/settings';
import { bootTestApp } from '../helpers/api';

const sepia = { ...lightTheme, id: 'sepia', name: 'Sepia' };

describe('resolveTheme', () => {
  it('picks the configured theme for the effective scheme and falls back to built-ins', () => {
    const preference = { mode: 'system' as const, light: 'sepia', dark: 'missing' };
    expect(resolveTheme(preference, 'light', [lightTheme, darkTheme, sepia])).toBe(sepia);
    expect(resolveTheme(preference, 'dark', [lightTheme, darkTheme, sepia])).toBe(darkTheme);
    expect(resolveTheme({ ...preference, mode: 'dark' }, 'light', [lightTheme, darkTheme])).toBe(darkTheme);
    expect(resolveTheme({ ...preference, light: 'dark' }, 'light', [lightTheme, darkTheme])).toBe(lightTheme);
  });
});

describe('applyTheme and applyTypography', () => {
  it('writes custom properties, the data attribute, the colour scheme and typography', () => {
    const root = document.createElement('html');

    applyTheme(root, darkTheme);
    applyTypography(root, { uiFont: 'Fira', fontSize: 16 });

    expect(root.style.getPropertyValue('--color-bg')).toBe('#141414');
    expect(root.style.getPropertyValue('--color-surface-raised')).toBe('#262626');
    expect(root.dataset['theme']).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
    expect(root.style.getPropertyValue('--font-family')).toContain('Fira');
    expect(root.style.fontSize).toBe('16px');
  });
});

describe('theme hooks', () => {
  it('reacts to system changes and to preference updates', async () => {
    const api = await bootTestApp();
    const { result } = renderHook(() => ({ active: useActiveTheme(), themes: useThemes() }));

    expect(result.current.active.id).toBe('light');
    expect(result.current.themes).toHaveLength(2);

    act(() => {
      api.emitNativeTheme('dark');
    });
    expect(result.current.active.id).toBe('dark');

    await act(async () => {
      await updateSettings({ theme: { mode: 'light', light: 'light', dark: 'dark' } });
    });
    expect(result.current.active.id).toBe('light');
  });
});
