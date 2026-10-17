import { useState } from 'react';
import { getSystemLocale, useTranslation } from '@renderer/lib/i18n';
import { updateSettings, useSettings } from '@renderer/lib/settings';
import { useThemes } from '@renderer/lib/theme';
import { Dialog, Field, Input, Select, Tabs, ToggleGroup } from '@renderer/ui';
import type { LanguageSetting, ThemeMode } from '@shared/app-settings';
import { SUPPORTED_LANGUAGES } from '@shared/i18n';
import styles from './PreferencesDialog.module.scss';

export interface PreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODES: ThemeMode[] = ['system', 'light', 'dark'];

function FontSizeField({ value }: { value: number }) {
  const { t } = useTranslation('settings');
  const [draft, setDraft] = useState(String(value));
  return (
    <Field label={t('appearance.fontSize')} hint={t('appearance.fontSizeHint')}>
      <Input
        type="number"
        min={10}
        max={24}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          const fontSize = Number(event.target.value);
          if (Number.isInteger(fontSize) && fontSize >= 10 && fontSize <= 24)
            void updateSettings({ fontSize });
        }}
        className={styles['number']}
      />
    </Field>
  );
}

export function PreferencesDialog({ open, onOpenChange }: PreferencesDialogProps) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const settings = useSettings();
  const themes = useThemes();

  const themeOptions = (base: 'light' | 'dark') =>
    themes.filter((theme) => theme.base === base).map((theme) => ({ value: theme.id, label: theme.name }));

  const languageOptions = [
    { value: 'system', label: t('language.system', { locale: getSystemLocale() }) },
    ...SUPPORTED_LANGUAGES.map((language) => ({ value: language, label: t(`language.${language}`) })),
  ];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content title={t('title')} closeLabel={tc('actions.close')} size="md">
        <Tabs.Root defaultValue="appearance" className={styles['tabs']}>
          <Tabs.List aria-label={t('title')}>
            <Tabs.Trigger value="appearance">{t('tabs.appearance')}</Tabs.Trigger>
            <Tabs.Trigger value="language">{t('tabs.language')}</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="appearance" className={styles['panel']}>
            <Field label={t('appearance.mode')}>
              <ToggleGroup
                aria-label={t('appearance.mode')}
                value={settings.theme.mode}
                onValueChange={(mode) =>
                  void updateSettings({ theme: { ...settings.theme, mode: mode as ThemeMode } })
                }
                items={MODES.map((mode) => ({ value: mode, label: t(`appearance.modes.${mode}`) }))}
              />
            </Field>
            <Field label={t('appearance.lightTheme')}>
              <Select
                options={themeOptions('light')}
                value={settings.theme.light}
                onValueChange={(light) => void updateSettings({ theme: { ...settings.theme, light } })}
              />
            </Field>
            <Field label={t('appearance.darkTheme')}>
              <Select
                options={themeOptions('dark')}
                value={settings.theme.dark}
                onValueChange={(dark) => void updateSettings({ theme: { ...settings.theme, dark } })}
              />
            </Field>
            <FontSizeField key={settings.fontSize} value={settings.fontSize} />
          </Tabs.Content>
          <Tabs.Content value="language" className={styles['panel']}>
            <Field label={t('language.label')}>
              <Select
                options={languageOptions}
                value={settings.language}
                onValueChange={(language) => void updateSettings({ language: language as LanguageSetting })}
              />
            </Field>
          </Tabs.Content>
        </Tabs.Root>
      </Dialog.Content>
    </Dialog.Root>
  );
}
