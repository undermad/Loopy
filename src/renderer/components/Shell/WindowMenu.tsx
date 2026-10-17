import type { LayoutPreset } from '@shared/layout';
import { builtInLayoutPresets } from '@shared/layout-presets';
import { useTranslation } from '@renderer/lib/i18n';
import { useCurrentProject } from '@renderer/lib/project';
import { describeKeys, keymap } from '@renderer/lib/shortcuts';
import {
  applyLayout,
  currentLayout,
  deleteLayout,
  exportLayout,
  importLayout,
  setStatusBarVisible,
  toggleFullscreen,
  useLayoutPresets,
  useStatusBarVisible,
} from '@renderer/lib/workspaces';
import { Menubar, useToast } from '@renderer/ui';

export function WindowMenu({ onDialog }: { onDialog: (dialog: 'saveLayout') => void }) {
  const { t } = useTranslation('shell');
  const toast = useToast();
  const project = useCurrentProject();
  const statusBar = useStatusBarVisible();
  const customPresets = useLayoutPresets();
  const presets = builtInLayoutPresets({
    default: t('layout.presets.default'),
    planning: t('layout.presets.planning'),
    design: t('layout.presets.design'),
    palette: t('layout.presets.palette'),
    assets: t('layout.presets.assets'),
  });

  async function runImport() {
    const result = await importLayout();
    if (result.status === 'imported')
      toast.show({ title: t('layout.imported', { name: result.layout.name }), variant: 'success' });
    if (result.status === 'invalid') toast.show({ title: t('layout.invalid'), variant: 'danger' });
  }

  async function runExport(preset: LayoutPreset) {
    const result = await exportLayout(preset);
    if (result.status === 'exported') toast.show({ title: t('layout.exported'), variant: 'success' });
  }

  return (
    <Menubar.Menu>
      <Menubar.Trigger>{t('menu.window')}</Menubar.Trigger>
      <Menubar.Content>
        <Menubar.Item onSelect={() => void toggleFullscreen()}>
          {t('menu.toggleFullscreen')}
          <Menubar.Shortcut>{describeKeys(keymap.fullscreen.keys)}</Menubar.Shortcut>
        </Menubar.Item>
        <Menubar.Separator />
        <Menubar.Item
          disabled={!project}
          onSelect={() => {
            onDialog('saveLayout');
          }}
        >
          {t('menu.saveLayout')}
        </Menubar.Item>
        <Menubar.Sub>
          <Menubar.SubTrigger disabled={!project}>{t('menu.loadLayout')}</Menubar.SubTrigger>
          <Menubar.SubContent>
            <Menubar.Label>{t('layout.builtIn')}</Menubar.Label>
            {presets.map((preset) => (
              <Menubar.Item
                key={preset.id}
                onSelect={() => {
                  applyLayout(preset);
                }}
              >
                {preset.name}
              </Menubar.Item>
            ))}
            <Menubar.Separator />
            <Menubar.Label>{t('layout.custom')}</Menubar.Label>
            {customPresets.length === 0 ? <Menubar.Item disabled>{t('layout.none')}</Menubar.Item> : null}
            {customPresets.map((preset) => (
              <Menubar.Sub key={preset.id}>
                <Menubar.SubTrigger>{preset.name}</Menubar.SubTrigger>
                <Menubar.SubContent>
                  <Menubar.Item
                    onSelect={() => {
                      applyLayout(preset);
                    }}
                  >
                    {t('menu.loadLayout')}
                  </Menubar.Item>
                  <Menubar.Item onSelect={() => void runExport(preset)}>
                    {t('menu.exportLayout')}
                  </Menubar.Item>
                  <Menubar.Item onSelect={() => void deleteLayout(preset.id)}>
                    {t('layout.deletePreset')}
                  </Menubar.Item>
                </Menubar.SubContent>
              </Menubar.Sub>
            ))}
          </Menubar.SubContent>
        </Menubar.Sub>
        <Menubar.Item
          disabled={!project}
          onSelect={() => {
            const preset = presets[0];
            if (preset) applyLayout(preset);
          }}
        >
          {t('menu.resetLayout')}
        </Menubar.Item>
        <Menubar.Item onSelect={() => void runImport()}>{t('menu.importLayout')}</Menubar.Item>
        <Menubar.Item disabled={!project} onSelect={() => void runExport(currentLayout(t('layout.current')))}>
          {t('menu.exportLayout')}
        </Menubar.Item>
        <Menubar.Separator />
        <Menubar.CheckboxItem
          checked={statusBar}
          onCheckedChange={(checked) => void setStatusBarVisible(checked)}
        >
          {t('menu.toggleStatusBar')}
        </Menubar.CheckboxItem>
      </Menubar.Content>
    </Menubar.Menu>
  );
}
