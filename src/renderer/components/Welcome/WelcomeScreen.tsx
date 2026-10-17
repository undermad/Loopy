import { useState } from 'react';
import { FolderOpen, Inbox, Plus } from 'lucide-react';
import { useFormat, useTranslation } from '@renderer/lib/i18n';
import {
  deleteProject,
  exportProject,
  importProject,
  openProject,
  removeRecentProject,
  revealProject,
  useProjectList,
  useRecentProjects,
} from '@renderer/lib/project';
import { Button, ConfirmDialog, ContextMenu, EmptyState, useToast } from '@renderer/ui';
import type { ProjectSummary } from '@shared/ipc';
import { NewProjectDialog } from './NewProjectDialog';
import { ProjectRow } from './ProjectRow';
import styles from './WelcomeScreen.module.scss';

export function WelcomeScreen() {
  const { t } = useTranslation('welcome');
  const { t: tc } = useTranslation('common');
  const format = useFormat();
  const toast = useToast();
  const projects = useProjectList();
  const recent = useRecentProjects();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);

  async function open(id: string) {
    const result = await openProject(id);
    if (result.status === 'failed')
      toast.show({ title: t('openFailed'), description: result.code, variant: 'danger' });
  }

  async function importFile() {
    const result = await importProject();
    if (result.status === 'imported')
      toast.show({ title: t('imported', { name: result.project.name }), variant: 'success' });
    if (result.status === 'failed')
      toast.show({ title: t('openFailed'), description: result.code, variant: 'danger' });
  }

  const projectIds = new Set(projects.map((project) => project.id));

  return (
    <div className={styles['welcome']}>
      <section className={styles['hero']}>
        <h1 className={styles['title']}>{t('title')}</h1>
        <p className={styles['tagline']}>{tc('app.tagline')}</p>
        <div className={styles['actions']}>
          <Button
            variant="primary"
            icon={<Plus aria-hidden="true" />}
            onClick={() => {
              setCreateOpen(true);
            }}
          >
            {t('newProject')}
          </Button>
          <Button icon={<FolderOpen aria-hidden="true" />} onClick={() => void importFile()}>
            {t('openFile')}
          </Button>
          <p className={styles['hint']}>{t('openFileHint')}</p>
        </div>
      </section>
      <div className={styles['lists']}>
        <section className={styles['section']} aria-labelledby="welcome-projects">
          <h2 id="welcome-projects" className={styles['heading']}>
            {t('projects')}
          </h2>
          {projects.length === 0 ? (
            <EmptyState icon={<Inbox />} title={t('noProjects')} description={t('noProjectsHint')} />
          ) : (
            <ul className={styles['list']}>
              {projects.map((project) => (
                <ProjectRow
                  key={project.id}
                  name={project.name}
                  meta={t('lastOpened', { when: format.relative(project.lastOpenedAt ?? project.updatedAt) })}
                  onOpen={() => void open(project.id)}
                  menu={
                    <>
                      <ContextMenu.Item onSelect={() => void open(project.id)}>
                        {tc('actions.open')}
                      </ContextMenu.Item>
                      <ContextMenu.Item onSelect={() => void revealProject(project.id)}>
                        {t('reveal')}
                      </ContextMenu.Item>
                      <ContextMenu.Item onSelect={() => void open(project.id).then(() => exportProject())}>
                        {tc('actions.export')}
                      </ContextMenu.Item>
                      <ContextMenu.Separator />
                      <ContextMenu.Item
                        onSelect={() => {
                          setDeleteTarget(project);
                        }}
                      >
                        {tc('actions.delete')}
                      </ContextMenu.Item>
                    </>
                  }
                />
              ))}
            </ul>
          )}
        </section>
        <section className={styles['section']} aria-labelledby="welcome-recent">
          <h2 id="welcome-recent" className={styles['heading']}>
            {t('recent')}
          </h2>
          {recent.length === 0 ? (
            <p className={styles['hint']}>{t('noRecent')}</p>
          ) : (
            <ul className={styles['list']}>
              {recent.map((entry) => {
                const missing = !projectIds.has(entry.id);
                return (
                  <ProjectRow
                    key={entry.id}
                    name={entry.name}
                    meta={missing ? t('missing') : t('lastOpened', { when: format.relative(entry.openedAt) })}
                    disabled={missing}
                    onOpen={() => void open(entry.id)}
                    menu={
                      <ContextMenu.Item onSelect={() => void removeRecentProject(entry.id)}>
                        {t('removeRecent')}
                      </ContextMenu.Item>
                    }
                  />
                );
              })}
            </ul>
          )}
        </section>
      </div>
      <NewProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={tc('actions.delete')}
        description={t('deleteConfirm', { name: deleteTarget?.name ?? '' })}
        confirmLabel={tc('actions.delete')}
        cancelLabel={tc('actions.cancel')}
        closeLabel={tc('actions.close')}
        destructive
        onConfirm={async () => {
          if (deleteTarget) await deleteProject(deleteTarget.id);
        }}
      />
    </div>
  );
}
