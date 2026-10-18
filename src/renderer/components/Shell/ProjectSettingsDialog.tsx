import { useState } from 'react';
import { useTranslation } from '@renderer/lib/i18n';
import { renameProject } from '@renderer/lib/project';
import { Button, Dialog, useToast } from '@renderer/ui';
import type { ProjectInfo } from '@shared/project';
import { ProjectDetails, validProjectDetails } from '../ProjectDetails/ProjectDetails';

export interface ProjectSettingsDialogProps {
  project: ProjectInfo;
  onOpenChange: (open: boolean) => void;
}

export function ProjectSettingsDialog({ project, onOpenChange }: ProjectSettingsDialogProps) {
  const { t } = useTranslation('shell');
  const { t: tc } = useTranslation('common');
  const toast = useToast();
  const [details, setDetails] = useState({ name: project.name });
  const [busy, setBusy] = useState(false);
  const valid = validProjectDetails(details);

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      if (details.name.trim() !== project.name) await renameProject(details.name.trim());
      onOpenChange(false);
    } catch {
      toast.show({ title: tc('errors.generic'), variant: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Content title={t('project.settingsTitle')} closeLabel={tc('actions.close')} size="sm">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <ProjectDetails value={details} onChange={setDetails} autoFocus />
          <Dialog.Footer>
            <Dialog.Close asChild>
              <Button variant="ghost">{tc('actions.cancel')}</Button>
            </Dialog.Close>
            <Button type="submit" variant="primary" disabled={!valid} loading={busy}>
              {tc('actions.save')}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
