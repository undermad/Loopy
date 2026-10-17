import { useTranslation } from '@renderer/lib/i18n';
import { describeKeys, keymap } from '@renderer/lib/shortcuts';
import { Dialog, Kbd } from '@renderer/ui';
import styles from './ShortcutsDialog.module.scss';

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('shell');
  const { t: tc } = useTranslation('common');
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content title={t('shortcuts.title')} closeLabel={tc('actions.close')} size="sm">
        <table className={styles['table']}>
          <thead>
            <tr>
              <th>{t('shortcuts.action')}</th>
              <th>{t('shortcuts.keys')}</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(keymap).map((shortcut) => (
              <tr key={shortcut.id}>
                <td>{t(shortcut.labelKey as 'menu.newProject')}</td>
                <td>
                  {describeKeys(shortcut.keys)
                    .split(' + ')
                    .map((key) => (
                      <Kbd key={key} className={styles['key']}>
                        {key}
                      </Kbd>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Dialog.Content>
    </Dialog.Root>
  );
}
