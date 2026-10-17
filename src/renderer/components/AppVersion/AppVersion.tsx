import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import type { AppVersion as AppVersionInfo } from '@shared/ipc';
import { useTranslation } from '@renderer/lib/i18n';
import { Tooltip } from '@renderer/ui';
import styles from './AppVersion.module.scss';

export function AppVersion() {
  const { t } = useTranslation('common');
  const [version, setVersion] = useState<AppVersionInfo | null>(null);

  useEffect(() => {
    let active = true;
    void window.loopy.getAppVersion().then((info) => {
      if (active) setVersion(info);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!version) return <p className={styles['version']}>{t('labels.loading')}</p>;

  return (
    <Tooltip content={t('labels.electron', { version: version.electron })}>
      <button
        type="button"
        className={styles['version']}
        aria-label={t('labels.version', { version: version.app })}
      >
        <Info size={16} aria-hidden="true" />
        <span>v{version.app}</span>
      </button>
    </Tooltip>
  );
}
