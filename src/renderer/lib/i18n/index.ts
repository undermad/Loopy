import { useMemo } from 'react';
import i18next from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import type { LanguageSetting } from '@shared/app-settings';
import { DEFAULT_LANGUAGE, resolveLanguage, resources, type Language } from '@shared/i18n';

let systemLocale: string = DEFAULT_LANGUAGE;

export async function initI18n(language: LanguageSetting, locale: string): Promise<void> {
  systemLocale = locale;
  if (i18next.isInitialized) {
    await applyLanguage(language);
    return;
  }
  await i18next.use(initReactI18next).init({
    resources,
    lng: resolveLanguage(language, locale),
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export async function applyLanguage(language: LanguageSetting): Promise<Language> {
  const resolved = resolveLanguage(language, systemLocale);
  if (i18next.language !== resolved) await i18next.changeLanguage(resolved);
  return resolved;
}

export function getSystemLocale(): string {
  return systemLocale;
}

export function useFormat() {
  const { i18n } = useTranslation();
  const language = i18n.language;
  return useMemo(() => {
    const dateTime = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' });
    const dateOnly = new Intl.DateTimeFormat(language, { dateStyle: 'medium' });
    const relative = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
    return {
      dateTime: (value: string | number | Date) => dateTime.format(new Date(value)),
      date: (value: string) => dateOnly.format(new Date(`${value}T00:00:00`)),
      relative: (value: string | number | Date, now = Date.now()) => {
        const seconds = Math.round((new Date(value).getTime() - now) / 1000);
        const units: [Intl.RelativeTimeFormatUnit, number][] = [
          ['year', 31_536_000],
          ['month', 2_592_000],
          ['week', 604_800],
          ['day', 86_400],
          ['hour', 3_600],
          ['minute', 60],
        ];
        for (const [unit, size] of units) {
          if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
        }
        return relative.format(seconds, 'second');
      },
    };
  }, [language]);
}

export { useTranslation };
export type { Language };
