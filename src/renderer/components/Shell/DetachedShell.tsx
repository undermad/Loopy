import { ArrowLeftToLine } from 'lucide-react';
import { findArea } from '@renderer/lib/layout';
import { useTranslation } from '@renderer/lib/i18n';
import { useCurrentProject } from '@renderer/lib/project';
import { returnToMainWindow, useActiveWorkspace } from '@renderer/lib/workspaces';
import { Button } from '@renderer/ui';
import { AreaTree } from './AreaTree';
import styles from './AppShell.module.scss';

export function DetachedShell() {
  const { t } = useTranslation('shell');
  const project = useCurrentProject();
  const workspace = useActiveWorkspace();
  if (!workspace) return null;
  const maximised = workspace.maximisedAreaId ? findArea(workspace.root, workspace.maximisedAreaId) : null;
  return (
    <div className={styles['detached']}>
      <header className={styles['detachedBar']}>
        <span className={styles['detachedTitle']}>{project?.name ?? t('window.title')}</span>
        <Button
          size="sm"
          variant="ghost"
          icon={<ArrowLeftToLine aria-hidden="true" />}
          onClick={() => void returnToMainWindow()}
        >
          {t('window.return')}
        </Button>
      </header>
      <div className={styles['workspace']}>
        <AreaTree node={maximised ?? workspace.root} />
      </div>
    </div>
  );
}
