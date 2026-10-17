import { useState } from 'react';
import { Download, Plus, Trash2, Upload } from 'lucide-react';
import {
  THEME_COLOR_KEYS,
  THEME_SCHEMA_VERSION,
  isBuiltInThemeId,
  type Theme,
  type ThemeColorKey,
} from '@shared/theme';
import { useTranslation } from '@renderer/lib/i18n';
import { updateSettings, useSettings } from '@renderer/lib/settings';
import {
  deleteTheme,
  exportTheme,
  importTheme,
  saveTheme,
  useActiveTheme,
  useThemes,
} from '@renderer/lib/theme';
import { Button, ColorPicker, ConfirmDialog, Field, Input, Select, useToast } from '@renderer/ui';
import styles from './ThemesTab.module.scss';

export function ThemesTab() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const toast = useToast();
  const settings = useSettings();
  const themes = useThemes();
  const active = useActiveTheme();
  const [selectedId, setSelectedId] = useState(active.id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selected = themes.find((theme) => theme.id === selectedId) ?? active;
  const builtIn = isBuiltInThemeId(selected.id);

  async function duplicateCurrent() {
    const theme: Theme = {
      ...selected,
      schemaVersion: THEME_SCHEMA_VERSION,
      id: crypto.randomUUID(),
      name: `${selected.name} ${tc('actions.duplicate').toLowerCase()}`,
      colors: { ...selected.colors },
    };
    const saved = await saveTheme(theme);
    setSelectedId(saved.id);
    await updateSettings({ theme: { ...settings.theme, [saved.base]: saved.id } });
  }

  async function persist(next: Theme) {
    if (builtIn) return;
    await saveTheme(next);
  }

  async function runImport() {
    const result = await importTheme();
    if (result.status === 'imported') {
      setSelectedId(result.theme.id);
      toast.show({ title: t('themes.imported', { name: result.theme.name }), variant: 'success' });
    }
    if (result.status === 'invalid') toast.show({ title: t('themes.invalid'), variant: 'danger' });
  }

  async function runExport() {
    const result = await exportTheme(selected.id);
    if (result.status === 'exported') toast.show({ title: t('themes.exported'), variant: 'success' });
  }

  async function remove() {
    await deleteTheme(selected.id);
    const fallback = selected.base;
    await updateSettings({ theme: { ...settings.theme, [fallback]: fallback } });
    setSelectedId(fallback);
  }

  return (
    <div className={styles['tab']}>
      <div className={styles['toolbar']}>
        <Select
          aria-label={t('tabs.themes')}
          value={selected.id}
          onValueChange={setSelectedId}
          options={themes.map((theme) => ({
            value: theme.id,
            label: `${theme.name} (${isBuiltInThemeId(theme.id) ? t('themes.builtIn') : t('themes.custom')})`,
          }))}
        />
        <Button size="sm" icon={<Plus aria-hidden="true" />} onClick={() => void duplicateCurrent()}>
          {t('themes.newFromCurrent')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<Upload aria-hidden="true" />}
          onClick={() => void runImport()}
        >
          {t('themes.import')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<Download aria-hidden="true" />}
          onClick={() => void runExport()}
        >
          {t('themes.export')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<Trash2 aria-hidden="true" />}
          disabled={builtIn}
          onClick={() => {
            setConfirmDelete(true);
          }}
        >
          {t('themes.delete')}
        </Button>
      </div>
      <Field label={t('themes.name')}>
        <Input
          key={selected.id}
          defaultValue={selected.name}
          disabled={builtIn}
          onBlur={(event) => {
            const name = event.target.value.trim();
            if (name && name !== selected.name) void persist({ ...selected, name });
          }}
        />
      </Field>
      <div className={styles['grid']}>
        {THEME_COLOR_KEYS.map((key: ThemeColorKey) => (
          <div key={key} className={styles['swatchRow']}>
            <ColorPicker
              size="sm"
              value={selected.colors[key]}
              disabled={builtIn}
              label={t(`themes.colors.${key}`)}
              onChange={(value) =>
                void persist({ ...selected, colors: { ...selected.colors, [key]: value } })
              }
            />
            <span className={styles['swatchLabel']}>{t(`themes.colors.${key}`)}</span>
            <code className={styles['swatchValue']}>{selected.colors[key]}</code>
          </div>
        ))}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('themes.delete')}
        description={t('themes.deleteConfirm', { name: selected.name })}
        confirmLabel={tc('actions.delete')}
        cancelLabel={tc('actions.cancel')}
        closeLabel={tc('actions.close')}
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
