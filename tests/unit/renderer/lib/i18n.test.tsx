import { renderHook } from '@testing-library/react';
import i18next from 'i18next';
import { describe, expect, it } from 'vitest';
import { applyLanguage, getSystemLocale, useFormat, useTranslation } from '@renderer/lib/i18n';
import { bootTestApp } from '../helpers/api';

describe('i18n library', () => {
  it('initialises from settings, exposes the system locale and translates keys', async () => {
    await bootTestApp();

    expect(getSystemLocale()).toBe('en-GB');
    const { result } = renderHook(() => useTranslation('settings'));
    expect(result.current.t('title')).toBe('Preferences');
    expect(await applyLanguage('en')).toBe('en');
    expect(i18next.language).toBe('en');
  });

  it('formats dates and relative times in the active language', async () => {
    await bootTestApp();
    const { result } = renderHook(() => useFormat());
    const now = Date.parse('2026-10-17T12:00:00.000Z');

    expect(result.current.relative('2026-10-17T11:00:00.000Z', now)).toBe('1 hour ago');
    expect(result.current.relative('2026-10-14T12:00:00.000Z', now)).toBe('3 days ago');
    expect(result.current.relative('2026-10-17T11:59:50.000Z', now)).toBe('10 seconds ago');
    expect(result.current.dateTime('2026-10-17T12:00:00.000Z')).toMatch(/2026/);
  });
});
