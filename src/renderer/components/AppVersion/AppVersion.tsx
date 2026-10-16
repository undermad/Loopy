import { useEffect, useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Info } from 'lucide-react';
import type { AppVersion as AppVersionInfo } from '@shared/ipc';
import styles from './AppVersion.module.scss';

export function AppVersion() {
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

  if (!version) return <p className={styles['version']}>Loading version…</p>;

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button type="button" className={styles['version']} aria-label={`Loopy v${version.app}`}>
            <Info size={16} aria-hidden="true" />
            <span>v{version.app}</span>
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className={styles['tooltip']} sideOffset={6}>
            Electron {version.electron}
            <Tooltip.Arrow className={styles['arrow']} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
