import { useEffect } from 'react';
import i18next from 'i18next';
import type { DataDomain, LoopyApi } from '@shared/ipc';
import { builtInLayoutPresets } from '@shared/layout-presets';
import { bootAssets, loadAssets } from '@renderer/lib/assets';
import { bootBoardShortcuts, bootBoards, refreshBoards } from '@renderer/lib/board';
import { applyLanguage, initI18n } from '@renderer/lib/i18n';
import { bootCardTemplates, loadCardTemplates } from '@renderer/lib/cards';
import { bootNotes, flushNotes, loadNotes } from '@renderer/lib/notes';
import { bootPalettes, loadPalettes } from '@renderer/lib/palettes';
import { bootProject, currentProject } from '@renderer/lib/project';
import { bootSettings, useSettings } from '@renderer/lib/settings';
import { bootTheme } from '@renderer/lib/theme';
import { bootTickets, loadTickets } from '@renderer/lib/tickets';
import { bootWindows, bootWorkspaces } from '@renderer/lib/workspaces';
import { registerEditors } from './components/editors/registerEditors';

export async function bootstrap(api: LoopyApi): Promise<void> {
  registerEditors();
  const [settings, locale] = await Promise.all([
    bootSettings(api),
    api.getLocale(),
    bootTheme(api),
    bootProject(api),
  ]);
  await initI18n(settings.language, locale);
  await bootTickets(api, currentProject() !== null);
  await bootBoards(api, currentProject() !== null);
  bootBoardShortcuts();
  await bootPalettes(api, currentProject() !== null);
  await bootCardTemplates(api, currentProject() !== null);
  await bootAssets(api, currentProject() !== null);
  await bootNotes(api, currentProject() !== null);
  await bootWorkspaces(api, () => {
    const names = {
      default: i18next.t('shell:layout.presets.default'),
      planning: i18next.t('shell:layout.presets.planning'),
      design: i18next.t('shell:layout.presets.design'),
      palette: i18next.t('shell:layout.presets.palette'),
      assets: i18next.t('shell:layout.presets.assets'),
      ideas: i18next.t('shell:layout.presets.ideas'),
    };
    return builtInLayoutPresets(names)[0]?.workspaces ?? [];
  });
  await bootWindows(api);
  const refresh: Record<DataDomain, () => Promise<unknown>> = {
    tickets: loadTickets,
    boards: refreshBoards,
    palettes: loadPalettes,
    cards: loadCardTemplates,
    assets: loadAssets,
    notes: loadNotes,
  };
  window.addEventListener('beforeunload', () => {
    void flushNotes();
  });
  api.onProjectDataChanged(({ domain }) => {
    if (currentProject()) void refresh[domain]().catch(() => undefined);
  });
}

export function useLanguageSync(): void {
  const language = useSettings().language;
  useEffect(() => {
    void applyLanguage(language);
  }, [language]);
}
