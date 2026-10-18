import { FolderOpen, Plus } from 'lucide-react';
import { useFormat, useTranslation } from '@renderer/lib/i18n';
import {
  discardRecovery,
  openProject,
  openRecentProject,
  recoverProject,
  removeRecentProject,
  revealProject,
  startCreatingProject,
  useCreatingProject,
  useRecentProjects,
  useRecoverableProjects,
} from '@renderer/lib/project';
import { Button, ContextMenu, useToast } from '@renderer/ui';
import type { OpenProjectResult } from '@shared/ipc';
import { ProjectCreateView } from './ProjectCreateView';
import { ProjectRow } from './ProjectRow';
import styles from './WelcomeScreen.module.scss';

export function WelcomeScreen() {
  const { t } = useTranslation('welcome');
  const { t: tc } = useTranslation('common');
  const format = useFormat();
  const toast = useToast();
  const creating = useCreatingProject();
  const recent = useRecentProjects();
  const recoverable = useRecoverableProjects();

  async function report(pending: Promise<OpenProjectResult>) {
    const result = await pending;
    if (result.status === 'failed')
      toast.show({ title: t('openFailed'), description: result.code, variant: 'danger' });
  }

  if (creating) return <ProjectCreateView />;

  return (
    <div className={styles['welcome']}>
      <section className={styles['hero']}>
        <h1 className={styles['title']}>{t('title')}</h1>
        <p className={styles['tagline']}>{tc('app.tagline')}</p>
        <div className={styles['actions']}>
          <Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={startCreatingProject}>
            {t('newProject')}
          </Button>
          <Button icon={<FolderOpen aria-hidden="true" />} onClick={() => void report(openProject())}>
            {t('openFile')}
          </Button>
        </div>
      </section>
      <div className={styles['lists']}>
        {recoverable.length > 0 ? (
          <section className={styles['recover']} aria-labelledby="welcome-recover">
            <h2 id="welcome-recover" className={styles['heading']}>
              {t('recoverTitle')}
            </h2>
            <p className={styles['hint']}>{t('recoverHint')}</p>
            <ul className={styles['list']}>
              {recoverable.map((entry) => (
                <li key={entry.id} className={styles['recoverRow']}>
                  <span className={styles['rowText']}>
                    <span className={styles['rowName']}>{entry.name}</span>
                    <span className={styles['rowMeta']}>
                      {entry.path ?? t('notSaved')} ·{' '}
                      {t('changed', { when: format.relative(entry.modifiedAt) })}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="primary"
                    aria-label={t('restoreNamed', { name: entry.name })}
                    onClick={() => void report(recoverProject(entry.id))}
                  >
                    {t('restore')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t('discardNamed', { name: entry.name })}
                    onClick={() => void discardRecovery(entry.id)}
                  >
                    {t('discard')}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section className={styles['section']} aria-labelledby="welcome-recent">
          <h2 id="welcome-recent" className={styles['heading']}>
            {t('recent')}
          </h2>
          {recent.length === 0 ? (
            <p className={styles['hint']}>{t('noRecent')}</p>
          ) : (
            <ul className={styles['list']}>
              {recent.map((entry) => (
                <ProjectRow
                  key={entry.path}
                  name={entry.name}
                  path={entry.path}
                  meta={
                    entry.missing ? t('missing') : t('lastOpened', { when: format.relative(entry.openedAt) })
                  }
                  disabled={entry.missing}
                  onOpen={() => void report(openRecentProject(entry.path))}
                  menu={
                    <>
                      <ContextMenu.Item
                        disabled={entry.missing}
                        onSelect={() => void report(openRecentProject(entry.path))}
                      >
                        {tc('actions.open')}
                      </ContextMenu.Item>
                      <ContextMenu.Item
                        disabled={entry.missing}
                        onSelect={() => void revealProject(entry.path)}
                      >
                        {t('reveal')}
                      </ContextMenu.Item>
                      <ContextMenu.Separator />
                      <ContextMenu.Item onSelect={() => void removeRecentProject(entry.path)}>
                        {t('removeRecent')}
                      </ContextMenu.Item>
                    </>
                  }
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
