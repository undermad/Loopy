import { useState } from 'react';
import { useTranslation } from '@renderer/lib/i18n';
import { createProject, stopCreatingProject } from '@renderer/lib/project';
import { Button, useToast } from '@renderer/ui';
import { ProjectDetails, validProjectDetails } from '../ProjectDetails/ProjectDetails';
import styles from './WelcomeScreen.module.scss';

export function ProjectCreateView() {
  const { t } = useTranslation('welcome');
  const { t: tc } = useTranslation('common');
  const toast = useToast();
  const [details, setDetails] = useState({ name: tc('labels.untitled') });
  const [busy, setBusy] = useState(false);
  const valid = validProjectDetails(details);

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const result = await createProject(details.name.trim());
      if (result.status === 'opened')
        toast.show({ title: t('created', { name: result.project.name }), variant: 'success' });
      if (result.status === 'failed')
        toast.show({ title: tc('errors.generic'), description: result.code, variant: 'danger' });
    } catch {
      toast.show({ title: tc('errors.generic'), variant: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles['create']} aria-labelledby="create-project-title">
      <h1 id="create-project-title" className={styles['title']}>
        {t('createTitle')}
      </h1>
      <p className={styles['tagline']}>{t('createIntro')}</p>
      <form
        className={styles['createForm']}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <ProjectDetails value={details} onChange={setDetails} autoFocus />
        <div className={styles['createActions']}>
          <Button variant="ghost" onClick={stopCreatingProject}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={!valid} loading={busy}>
            {tc('actions.create')}
          </Button>
        </div>
      </form>
    </section>
  );
}
