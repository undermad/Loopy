import assets from './locales/en/assets.json';
import colours from './locales/en/colours.json';
import common from './locales/en/common.json';
import editors from './locales/en/editors.json';
import notes from './locales/en/notes.json';
import settings from './locales/en/settings.json';
import shell from './locales/en/shell.json';
import tables from './locales/en/tables.json';
import welcome from './locales/en/welcome.json';

export const SUPPORTED_LANGUAGES = ['en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'en';

export const resources = {
  en: { common, settings, shell, welcome, editors, colours, assets, notes, tables },
} as const;

export type Namespace = keyof (typeof resources)['en'];
export const NAMESPACES = Object.keys(resources.en) as Namespace[];

export function isSupportedLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function resolveLanguage(setting: 'system' | Language, systemLocale: string): Language {
  if (setting !== 'system') return setting;
  const base = systemLocale.toLowerCase().split(/[-_]/)[0] ?? '';
  return isSupportedLanguage(base) ? base : DEFAULT_LANGUAGE;
}
