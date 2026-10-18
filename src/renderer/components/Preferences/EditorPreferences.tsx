import type { EditorPreferences } from '@shared/app-settings';
import { useTranslation } from '@renderer/lib/i18n';
import { updateSettings, useSettings } from '@renderer/lib/settings';
import { Field, Switch, ToggleGroup } from '@renderer/ui';
import styles from './PreferencesDialog.module.scss';

export function EditorPreferencesPanel() {
  const { t } = useTranslation('settings');
  const editors = useSettings().editors;
  const save = (patch: Partial<EditorPreferences>) =>
    void updateSettings({ editors: { ...editors, ...patch } });
  const board = (patch: Partial<EditorPreferences['board']>) => {
    save({ board: { ...editors.board, ...patch } });
  };
  const assets = (patch: Partial<EditorPreferences['assets']>) => {
    save({ assets: { ...editors.assets, ...patch } });
  };

  return (
    <>
      <p className={styles['hint']}>{t('editors.hint')}</p>
      <h3 className={styles['section']}>{t('editors.board')}</h3>
      <Switch
        label={t('editors.grid')}
        checked={editors.board.grid}
        onCheckedChange={(grid) => {
          board({ grid });
        }}
      />
      <Switch
        label={t('editors.snap')}
        checked={editors.board.snap}
        onCheckedChange={(snap) => {
          board({ snap });
        }}
      />
      <Switch
        label={t('editors.minimap')}
        checked={editors.board.minimap}
        onCheckedChange={(minimap) => {
          board({ minimap });
        }}
      />
      <Switch
        label={t('editors.quickButtons')}
        checked={editors.board.quickButtons}
        onCheckedChange={(quickButtons) => {
          board({ quickButtons });
        }}
      />
      <Field label={t('editors.wheel')}>
        <ToggleGroup
          aria-label={t('editors.wheel')}
          value={editors.board.wheel}
          onValueChange={(wheel) => {
            board({ wheel: wheel === 'pan' ? 'pan' : 'zoom' });
          }}
          items={[
            { value: 'zoom', label: t('editors.wheelZoom') },
            { value: 'pan', label: t('editors.wheelPan') },
          ]}
        />
      </Field>
      <h3 className={styles['section']}>{t('editors.assets')}</h3>
      <Field label={t('editors.layout')}>
        <ToggleGroup
          aria-label={t('editors.layout')}
          value={editors.assets.layout}
          onValueChange={(layout) => {
            assets({ layout: layout === 'list' ? 'list' : 'grid' });
          }}
          items={[
            { value: 'grid', label: t('editors.layoutGrid') },
            { value: 'list', label: t('editors.layoutList') },
          ]}
        />
      </Field>
      <Switch
        label={t('editors.details')}
        checked={editors.assets.details}
        onCheckedChange={(details) => {
          assets({ details });
        }}
      />
    </>
  );
}
