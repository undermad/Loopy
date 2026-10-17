import { useEffect } from 'react';
import { importFiles } from '@renderer/lib/assets';
import { useTranslation } from '@renderer/lib/i18n';
import { useCurrentProject } from '@renderer/lib/project';
import { useToast } from '@renderer/ui';

export function FileDropCatcher() {
  const { t } = useTranslation('shell');
  const toast = useToast();
  const project = useCurrentProject();

  useEffect(() => {
    if (!project) return undefined;
    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      const files = event.dataTransfer?.files;
      if (event.defaultPrevented || !files || files.length === 0) return;
      event.preventDefault();
      void importFiles(Array.from(files), 'auto')
        .then((outcome) => {
          if (outcome.ids.length > 0) {
            toast.show({
              title: t('status.filesImported', { count: outcome.ids.length }),
              variant: 'success',
            });
          }
        })
        .catch(() => {
          toast.show({ title: t('status.filesFailed'), variant: 'danger' });
        });
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [project, t, toast]);

  return null;
}
