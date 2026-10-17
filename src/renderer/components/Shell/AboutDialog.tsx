import { useEffect, useState } from 'react';
import type { AppVersion } from '@shared/ipc';
import { useTranslation } from '@renderer/lib/i18n';
import { Dialog } from '@renderer/ui';

export function AboutDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('shell');
  const { t: tc } = useTranslation('common');
  const [version, setVersion] = useState<AppVersion | null>(null);

  useEffect(() => {
    if (open) void window.loopy.getAppVersion().then(setVersion);
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        title={t('about.title')}
        description={t('about.description')}
        closeLabel={tc('actions.close')}
        size="sm"
      >
        <p>{version ? t('about.version', { version: version.app }) : tc('labels.loading')}</p>
        {version ? <p>{t('about.electron', { version: version.electron })}</p> : null}
      </Dialog.Content>
    </Dialog.Root>
  );
}
