import { useTranslation } from '@renderer/lib/i18n';
import { SHORTCUT_CATEGORIES, describeKeys } from '@renderer/lib/shortcuts';
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
  const text = (key: string) => t(key as 'shortcuts.title');
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content title={t('shortcuts.title')} closeLabel={tc('actions.close')} size="lg">
        <div className={styles['grid']}>
          {SHORTCUT_CATEGORIES.map((category) => (
            <section
              key={category.id}
              className={styles['category']}
              aria-labelledby={`shortcuts-${category.id}`}
            >
              <h3 id={`shortcuts-${category.id}`} className={styles['heading']}>
                {text(`shortcuts.categories.${category.id}`)}
              </h3>
              <table className={styles['table']}>
                <thead className={styles['hidden']}>
                  <tr>
                    <th>{t('shortcuts.action')}</th>
                    <th>{t('shortcuts.keys')}</th>
                  </tr>
                </thead>
                <tbody>
                  {category.entries.map((shortcut) => (
                    <tr key={shortcut.id}>
                      <td>{text(`shortcuts.items.${shortcut.id}`)}</td>
                      <td className={styles['keys']}>
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
            </section>
          ))}
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
