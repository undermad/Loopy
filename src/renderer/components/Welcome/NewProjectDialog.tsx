import { useState } from 'react';
import { useTranslation } from '@renderer/lib/i18n';
import { createProject } from '@renderer/lib/project';
import { Button, Dialog, Field, Input, useToast } from '@renderer/ui';
import { projectNameSchema } from '@shared/project';

export interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewProjectDialog({ open, onOpenChange }: NewProjectDialogProps) {
  const { t } = useTranslation('welcome');
  const { t: tc } = useTranslation('common');
  const toast = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = projectNameSchema.safeParse(name).success;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const project = await createProject(name.trim());
      toast.show({ title: t('created', { name: project.name }), variant: 'success' });
      setName('');
      onOpenChange(false);
    } catch {
      toast.show({ title: tc('errors.generic'), variant: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content title={t('createTitle')} closeLabel={tc('actions.close')} size="sm">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Field label={t('projectName')} hint={t('projectNameHint')} required>
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
              autoFocus
              maxLength={200}
            />
          </Field>
          <Dialog.Footer>
            <Dialog.Close asChild>
              <Button variant="ghost">{tc('actions.cancel')}</Button>
            </Dialog.Close>
            <Button type="submit" variant="primary" disabled={!valid} loading={busy}>
              {tc('actions.create')}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
