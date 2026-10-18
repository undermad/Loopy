import { useTranslation } from '@renderer/lib/i18n';
import { currentProject, saveProject, saveProjectAs } from '@renderer/lib/project';
import { useToast } from '@renderer/ui';
import type { SaveProjectResult } from '@shared/ipc';

export function useSaveCommands() {
  const { t } = useTranslation('shell');
  const toast = useToast();

  async function run(pending: () => Promise<SaveProjectResult>) {
    if (!currentProject()) return;
    const result = await pending();
    if (result.status === 'failed') toast.show({ title: t('project.saveFailed'), variant: 'danger' });
  }

  return {
    save: () => run(saveProject),
    saveAs: () => run(saveProjectAs),
  };
}
