import {
  ASSET_KINDS,
  DEFAULT_FOLDER_IDS,
  type AssetFolder,
  type AssetKind,
  type AssetSettings,
} from '@shared/assets';
import { assetActions } from '@renderer/lib/assets';
import { useTranslation } from '@renderer/lib/i18n';
import { Dialog, Field, Select } from '@renderer/ui';
import { ROOT_VALUE, folderIdOf, folderOptions } from './kinds';
import styles from './AssetOptionsDialog.module.scss';

export interface AssetOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: AssetFolder[];
  settings: AssetSettings;
}

function kindFolderValue(settings: AssetSettings, kind: AssetKind, folders: AssetFolder[]): string {
  const configured = settings.kindFolders[kind];
  if (configured === null) return ROOT_VALUE;
  const id = configured ?? (kind === 'other' ? null : DEFAULT_FOLDER_IDS[kind]);
  return id !== null && folders.some((folder) => folder.id === id) ? id : ROOT_VALUE;
}

export function AssetOptionsDialog({ open, onOpenChange, folders, settings }: AssetOptionsDialogProps) {
  const { t } = useTranslation('assets');
  const { t: tc } = useTranslation('common');
  const options = folderOptions(folders, t('topLevel'));
  const target =
    settings.dropTarget === 'byKind' || folders.some((folder) => folder.id === settings.dropTarget)
      ? settings.dropTarget
      : ROOT_VALUE;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content title={t('options')} closeLabel={tc('actions.close')} size="md">
        <div className={styles['body']}>
          <Field label={t('settings.dropTarget')} hint={t('settings.dropTargetHint')}>
            <Select
              options={[{ value: 'byKind', label: t('settings.byKind') }, ...options]}
              value={target}
              onValueChange={(value) =>
                void assetActions.setSettings({ dropTarget: value === ROOT_VALUE ? 'root' : value })
              }
            />
          </Field>
          {target === 'byKind' ? (
            <table className={styles['table']}>
              <caption className={styles['caption']}>{t('settings.kindFolders')}</caption>
              <tbody>
                {ASSET_KINDS.map((kind) => (
                  <tr key={kind}>
                    <th scope="row">{t(`kinds.${kind}`)}</th>
                    <td>
                      <Select
                        size="sm"
                        aria-label={t('settings.kindFolder', { kind: t(`kinds.${kind}`) })}
                        options={options}
                        value={kindFolderValue(settings, kind, folders)}
                        onValueChange={(value) =>
                          void assetActions.setSettings({ kindFolders: { [kind]: folderIdOf(value) } })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
