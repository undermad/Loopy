import { Trash2 } from 'lucide-react';
import { useTranslation } from '@renderer/lib/i18n';
import { templateActions, useTicketsSnapshot } from '@renderer/lib/tickets';
import { Dialog, IconButton } from '@renderer/ui';
import styles from './TemplatesDialog.module.scss';

export function TemplatesDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation('editors');
  const { t: tc } = useTranslation('common');
  const snapshot = useTicketsSnapshot();

  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Content title={t('ticket.templates')} closeLabel={tc('actions.close')}>
        {snapshot.templates.length === 0 ? (
          <p className={styles['empty']}>{t('ticket.noTemplates')}</p>
        ) : null}
        <ul className={styles['list']}>
          {snapshot.templates.map((template) => (
            <li key={template.id} className={styles['item']}>
              <span className={styles['name']}>{template.name}</span>
              <span className={styles['meta']}>
                {t(`tickets.types.${template.type}`)} · {t(`tickets.priorities.${template.priority}`)}
              </span>
              <IconButton
                label={`${t('ticket.deleteTemplate')}: ${template.name}`}
                size="sm"
                onClick={() => void templateActions.remove(template.id)}
              >
                <Trash2 aria-hidden="true" />
              </IconButton>
            </li>
          ))}
        </ul>
      </Dialog.Content>
    </Dialog.Root>
  );
}
