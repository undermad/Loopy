import { useEffect } from 'react';
import type { LoopyApi } from '@shared/ipc';
import { applyLanguage, initI18n } from '@renderer/lib/i18n';
import { bootProject } from '@renderer/lib/project';
import { bootSettings, useSettings } from '@renderer/lib/settings';
import { bootTheme } from '@renderer/lib/theme';

export async function bootstrap(api: LoopyApi): Promise<void> {
  const [settings, locale] = await Promise.all([
    bootSettings(api),
    api.getLocale(),
    bootTheme(api),
    bootProject(api),
  ]);
  await initI18n(settings.language, locale);
}

export function useLanguageSync(): void {
  const language = useSettings().language;
  useEffect(() => {
    void applyLanguage(language);
  }, [language]);
}
