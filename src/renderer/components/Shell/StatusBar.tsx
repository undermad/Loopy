import { useTranslation } from '@renderer/lib/i18n';
import { useCurrentProject, useProjectDirty } from '@renderer/lib/project';
import { useHoveredAreaId } from '@renderer/lib/workspaces';
import { AppVersion } from '../AppVersion/AppVersion';
import styles from './StatusBar.module.scss';

export function StatusBar() {
  const { t } = useTranslation('shell');
  const project = useCurrentProject();
  const dirty = useProjectDirty();
  const hovered = useHoveredAreaId();
  return (
    <footer className={styles['status']}>
      <span>{project ? t('status.project', { name: project.name }) : t('status.noProject')}</span>
      {project && dirty ? <span className={styles['unsaved']}>{t('status.unsaved')}</span> : null}
      <span className={styles['hint']}>{project && hovered ? t('status.hint') : t('status.ready')}</span>
      <span className={styles['spacer']} />
      <AppVersion />
    </footer>
  );
}
