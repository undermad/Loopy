import { createStore } from 'zustand/vanilla';
import { appSettingsSchema, type AppSettings, type AppSettingsPatch } from '@shared/app-settings';
import type { LoopyApi } from '@shared/ipc';

export type SettingsApi = Pick<LoopyApi, 'getSettings' | 'setSettings' | 'onSettingsChanged'>;

interface SettingsState {
  settings: AppSettings | null;
  api: SettingsApi | null;
}

export const settingsStore = createStore<SettingsState>(() => ({ settings: null, api: null }));

export async function bootSettings(api: SettingsApi): Promise<AppSettings> {
  const settings = await api.getSettings();
  settingsStore.setState({ settings, api });
  api.onSettingsChanged((next) => {
    settingsStore.setState({ settings: next });
  });
  return settings;
}

export async function updateSettings(patch: AppSettingsPatch): Promise<AppSettings> {
  const { api, settings } = settingsStore.getState();
  if (!api || !settings) throw new Error('Settings are not loaded');
  settingsStore.setState({ settings: appSettingsSchema.parse({ ...settings, ...patch }) });
  const saved = await api.setSettings(patch);
  settingsStore.setState({ settings: saved });
  return saved;
}

export function resetSettingsStore(): void {
  settingsStore.setState({ settings: null, api: null });
}
