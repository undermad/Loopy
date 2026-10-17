import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { resetSettingsStore, updateSettings, useSetting, useSettings } from '@renderer/lib/settings';
import { bootTestApp } from '../helpers/api';

describe('settings library', () => {
  it('loads settings, applies optimistic updates and follows pushes from main', async () => {
    const api = await bootTestApp({ fontSize: 12 });
    const { result } = renderHook(() => useSetting('fontSize'));
    expect(result.current).toBe(12);

    await act(async () => {
      await updateSettings({ fontSize: 20 });
    });
    expect(result.current).toBe(20);
    expect(api.setSettings).toHaveBeenCalledWith({ fontSize: 20 });

    act(() => {
      api.emitSettings({ ...api.settings, fontSize: 11 });
    });
    expect(result.current).toBe(11);
  });

  it('throws when read before boot', () => {
    resetSettingsStore();
    expect(() => renderHook(() => useSettings())).toThrow(/not loaded/);
  });
});
